// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.1.0/dist/ox-sdk.esm.js";
import * as THREE from "https://cdn.skypack.dev/three@0.127.0";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.127.0/examples/jsm/loaders/GLTFLoader.js";

// ====== ThreeJS ======

var renderer, scene, camera, floor, car, envMap;
var isCarPlaced = false;

function setupRenderer(rendererCanvas) {
  const width = rendererCanvas.width;
  const height = rendererCanvas.height;

  // Initialize renderer with rendererCanvas provided by Onirix SDK
  renderer = new THREE.WebGLRenderer({ canvas: rendererCanvas, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Ask Onirix SDK for camera parameters to create a 3D camera that fits with the AR projection.
  const cameraParams = OX.getCameraParameters();
  camera = new THREE.PerspectiveCamera(cameraParams.fov, cameraParams.aspect, 0.1, 1000);
  camera.matrixAutoUpdate = false;

  // Create an empty scene
  scene = new THREE.Scene();

  // Add some lights
  const hemisphereLight = new THREE.HemisphereLight(0xbbbbff, 0x444422);
  scene.add(hemisphereLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 10, 0);
  scene.add(directionalLight);

  // Load env map
  const textureLoader = new THREE.TextureLoader();
  envMap = textureLoader.load("envmap.jpg");
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  envMap.encoding = THREE.sRGBEncoding;

  // Add transparent floor to generate shadows
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    })
  );

  // Rotate floor to be horizontal
  floor.rotateX(Math.PI / 2);
}

function updatePose(pose) {
  // When a new pose is detected, update the 3D camera
  let modelViewMatrix = new THREE.Matrix4();
  modelViewMatrix = modelViewMatrix.fromArray(pose);
  camera.matrix = modelViewMatrix;
  camera.matrixWorldNeedsUpdate = true;
}

function onResize() {
  // When device orientation changes, it is required to update camera params.
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const cameraParams = OX.getCameraParameters();
  camera.fov = cameraParams.fov;
  camera.aspect = cameraParams.aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function render() {
  // Just render the scene
  renderer.render(scene, camera);
}

function onHitResult(hitResult) {
  if (car && !isCarPlaced) {
    document.getElementById("transform-controls").style.display = "block";
    car.position.copy(hitResult.position);
  }
}

function placeCar() {
  isCarPlaced = true;
  OX.start();
}

function scaleCar(value) {
  car.scale.set(value, value, value);
}

function rotateCar(value) {
  car.rotation.y = value;
}

function changeCarColor(value) {
  car.traverse((child) => {
    if (child.material && child.material.name === "CarPaint") {
      child.material.color.setHex(value);
    }
  });
}

// ====== Onirix SDK ======

const OX = new OnirixSDK(
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6MTQ0MjgsInJvbGUiOjMsImlhdCI6MTYxNjc1ODY5NX0.8F5eAPcBGaHzSSLuQAEgpdja9aEZ6Ca_Ll9wg84Rp5k"
);

const config = {
  mode: OnirixSDK.TrackingMode.Surface,
};

OX.init(config)
  .then((rendererCanvas) => {
    // Setup ThreeJS renderer
    setupRenderer(rendererCanvas);

    // Load car model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load("range_rover.glb", (gltf) => {
      car = gltf.scene;
      car.traverse((child) => {
        if (child.material) {
          console.log("updating material");
          child.material.envMap = envMap;
          child.material.needsUpdate = true;
        }
      });
      car.scale.set(0.5, 0.5, 0.5);
      scene.add(car);

      // All loaded, so hide loading screen
      document.getElementById("loading-screen").style.display = "none";

      document.getElementById("initializing").style.display = "block";

      document.getElementById("tap-to-place").addEventListener("click", () => {
        placeCar();
        document.getElementById("transform-controls").style.display = "none";
        document.getElementById("color-controls").style.display = "block";
      });

      const scaleSlider = document.getElementById("scale-slider");
      scaleSlider.addEventListener("input", () => {
        scaleCar(scaleSlider.value / 100);
      });
      const rotationSlider = document.getElementById("rotation-slider");
      rotationSlider.addEventListener("input", () => {
        rotateCar((rotationSlider.value * Math.PI) / 180);
      });

      document.getElementById("black").addEventListener("click", () => {
        changeCarColor(0x111111);
      });

      document.getElementById("silver").addEventListener("click", () => {
        changeCarColor(0xffffff);
      });

      document.getElementById("orange").addEventListener("click", () => {
        changeCarColor(0xff2600);
      });

      document.getElementById("blue").addEventListener("click", () => {
        changeCarColor(0x0011ff);
      });
    });

    // Subscribe to events
    OX.subscribe(OnirixSDK.Events.OnPose, function (pose) {
      updatePose(pose);
    });

    OX.subscribe(OnirixSDK.Events.OnResize, function () {
      onResize();
    });

    OX.subscribe(OnirixSDK.Events.OnTouch, function (touchPos) {
      onTouch(touchPos);
    });

    OX.subscribe(OnirixSDK.Events.OnHitTestResult, function (hitResult) {
      document.getElementById("initializing").style.display = "none";
      onHitResult(hitResult);
    });

    OX.subscribe(OnirixSDK.Events.OnFrame, function() {
      render();
    });

  })
  .catch((error) => {
    // An error ocurred, chech error type and display it
    document.getElementById("loading-screen").style.display = "none";

    switch (error.name) {
      case "INTERNAL_ERROR":
        document.getElementById("error-title").innerText = "Internal Error";
        document.getElementById("error-message").innerText =
          "An unespecified error has occurred. Your device might not be compatible with this experience.";
        break;

      case "CAMERA_ERROR":
        document.getElementById("error-title").innerText = "Camera Error";
        document.getElementById("error-message").innerText =
          "Could not access to your device's camera. Please, ensure you have given required permissions from your browser settings.";
        break;

      case "SENSORS_ERROR":
        document.getElementById("error-title").innerText = "Sensors Error";
        document.getElementById("error-message").innerText =
          "Could not access to your device's motion sensors. Please, ensure you have given required permissions from your browser settings.";
        break;

      case "LICENSE_ERROR":
        document.getElementById("error-title").innerText = "License Error";
        document.getElementById("error-message").innerText = "This experience does not exist or has been unpublished.";
        break;
    }

    document.getElementById("error-screen").style.display = "flex";
  });
