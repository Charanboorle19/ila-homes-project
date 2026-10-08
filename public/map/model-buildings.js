/**
 * Local GLB/GLTF icons — floating with a gentle yaw, spaced on the map.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function prepareModel(root, targetSizeMeters) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return root;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.add(root);

  // Center footprint; base at y=0 so float offset is clear
  root.position.x -= center.x;
  root.position.y -= box.min.y;
  root.position.z -= center.z;

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  wrapper.scale.setScalar(targetSizeMeters / maxDim);

  wrapper.traverse((obj) => {
    obj.frustumCulled = false;
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  return wrapper;
}

function asMatrixArray(args) {
  if (!args) return null;
  if (args.defaultProjectionData && args.defaultProjectionData.mainMatrix) {
    return args.defaultProjectionData.mainMatrix;
  }
  if (args.modelViewProjectionMatrix) return args.modelViewProjectionMatrix;
  if (Array.isArray(args) || (args.length === 16 && typeof args[0] === 'number')) return args;
  return null;
}

function modelMatrix(maplibregl, lngLat, altitudeMeters, yawRad) {
  const mc = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitudeMeters || 0);
  const scale = mc.meterInMercatorCoordinateUnits();
  // Tip model into map space, then yaw around vertical (Y-up) — turntable, not tumble
  const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), yawRad || 0);
  return new THREE.Matrix4()
    .makeTranslation(mc.x, mc.y, mc.z)
    .scale(new THREE.Vector3(scale, -scale, scale))
    .multiply(rotationX)
    .multiply(rotationY);
}

export async function createModelBuildingsLayer(maplibregl, placements) {
  const loader = new GLTFLoader();
  const items = [];
  let renderer;
  let mapRef;
  let currentYear = 9999;
  const camera = new THREE.Camera();
  const tmp = new THREE.Matrix4();
  const t0 = performance.now();

  async function loadOne(p, index) {
    const gltf = await loader.loadAsync(p.url);
    const raw = gltf.scene || gltf.scenes[0];
    const model = prepareModel(raw, p.sizeMeters || 140);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(40, 120, 60);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.7));
    scene.add(model);

    items.push({
      id: p.id,
      since: p.since || 0,
      lngLat: p.lngLat,
      // Base hover height + phase offset so icons don't bob in sync
      floatBase: p.floatMeters != null ? p.floatMeters : 28,
      floatAmp: p.floatAmp != null ? p.floatAmp : 5,
      phase: index * 0.85,
      spinSpeed: 0.18 + (index % 3) * 0.04, // rad/sec — gentle
      scene,
      model
    });
    console.info('[3D] loaded', p.id, 'size', p.sizeMeters);
    if (mapRef) mapRef.triggerRepaint();
  }

  const loadPromise = (async () => {
    // Keep placement order for phase variety; load small files first for speed
    const indexed = placements.map((p, i) => ({ p, i }));
    indexed.sort((a, b) => (a.p.sizeMeters || 50) - (b.p.sizeMeters || 50));
    for (const { p, i } of indexed) {
      try {
        await loadOne(p, i);
      } catch (err) {
        console.error('[3D] failed', p.id, p.url, err);
      }
    }
  })();

  const layer = {
    id: 'gltf-buildings',
    type: 'custom',
    renderingMode: '3d',

    onAdd(m, gl) {
      mapRef = m;
      renderer = new THREE.WebGLRenderer({
        canvas: mapRef.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
      if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
    },

    render(_gl, args) {
      if (!renderer || !items.length) return;
      const matrixArr = asMatrixArray(args);
      if (!matrixArr) return;

      const base = tmp.fromArray(matrixArr);
      const t = (performance.now() - t0) / 1000;

      items.forEach((item) => {
        if (currentYear < item.since) return;

        const alt =
          item.floatBase + Math.sin(t * 0.9 + item.phase) * item.floatAmp;
        const yaw = t * item.spinSpeed + item.phase;

        const l = modelMatrix(maplibregl, item.lngLat, alt, yaw);
        camera.projectionMatrix.copy(base).multiply(l);
        renderer.resetState();
        renderer.render(item.scene, camera);
      });

      mapRef.triggerRepaint();
    },

    setYear(year) {
      currentYear = year;
      if (mapRef) mapRef.triggerRepaint();
    },

    focus(_id) {
      if (mapRef) mapRef.triggerRepaint();
    },

    loadedIds() {
      return items.map((i) => i.id);
    },

    whenReady() {
      return loadPromise;
    }
  };

  return layer;
}
