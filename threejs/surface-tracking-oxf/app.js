// ====== Imports ======

import OnirixPlayer from "http://127.0.0.1:5003/oxf-player/dist/onirix-player.esm.js";
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.6.5/dist/ox-sdk.esm.js";

class OxExperience {
  oxSDK;
  oxPlayer;

  async init() {
    this._raycaster = new THREE.Raycaster();
    const renderCanvas = await this.initSDK();
    this.setupPlayer(renderCanvas);

    // Add transparent floor for model placement using raycasting
    this._floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
    );

    this._floor.rotateX(Math.PI / 2);
    this._floor.position.set(0, -1, 0);
    this.oxPlayer.getScene().add(this._floor);

    this.oxSDK.subscribe(OnirixSDK.Events.OnTouch, (touchPos) => {
      this.onTouch(touchPos);
    });

    this.oxSDK.subscribe(OnirixSDK.Events.OnFrame, () => {
      this.render();
    });

    this.oxSDK.subscribe(OnirixSDK.Events.OnPose, (pose) => {
      this.updatePose(pose);
    });

    this.oxSDK.subscribe(OnirixSDK.Events.OnResize, () => {
      this.onResize();
    });
  }

  async initSDK() {
    this.oxSDK = new OnirixSDK(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6MTQ0MjksInJvbGUiOjMsImlhdCI6MTYxNjc2MDI5M30.knKDX5vda6UyqB8CobqgPQ8BS7OYQo4RDfIuGm-EJGg"
    );
    const config = { mode: OnirixSDK.TrackingMode.Surface };
    return this.oxSDK.init(config);
  }

  setupPlayer(renderCanvas) {
    const host = "http://127.0.0.1:5003/oxf-samples/";
    const config = { canvas: renderCanvas, host };

    this.oxPlayer = new OnirixPlayer(config);
    const cameraParams = this.oxSDK.getCameraParameters();

    this.oxPlayer.updateCameraParameters(cameraParams);
    this.oxPlayer.onResize();
  }

  render() {
    this.oxPlayer.render();
  }

  updatePose(pose) {
    // When a new pose is detected, update the 3D camera
    this.oxPlayer.updatePose(pose);
  }

  onResize() {
    // When device orientation changes, it is required to update camera params.
    const cameraParams = this.oxSDK.getCameraParameters();
    this.oxPlayer.updateCameraParameters(cameraParams);
    this.oxPlayer.onResize();
  }

  async onTouch(touchPos) {
    // Raycast
    const camera = this.oxPlayer.getCamera();
    this._raycaster.setFromCamera(touchPos, camera);

    const intersects = this._raycaster.intersectObject(this._floor);
    if (intersects.length > 0 && intersects[0].object == this._floor) {
      const center = {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(),
      };

      await this.oxPlayer.load("bear.oxf", center);

      if (!this._started) {
        // Start tracking on first touch
        this.oxSDK.start();
        this._started = true;
      }
    }
  }
}

class OxExperienceUI {
  _loadingScreen = null;
  _errorScreen = null;
  _moveAnimation = null;
  _errorTitle = null;
  _errorMessage = null;

  _playButtonClickListener = null;

  init() {
    this._loadingScreen = document.querySelector("#loading-screen");
    this._errorScreen = document.querySelector("#error-screen");
    this._errorTitle = document.querySelector("#error-title");
    this._errorMessage = document.querySelector("#error-message");
  }

  setOnPlaceButtonClickListener(listener) {
    this._playButtonClickListener = listener;
  }

  hideLoadingScreen() {
    this._loadingScreen.style.display = "none";
  }

  showError(errorTitle, errorMessage) {
    this._errorTitle.innerText = errorTitle;
    this._errorMessage.innerText = errorMessage;
    this._errorScreen.style.display = "flex";
  }
}

const oxExp = new OxExperience();
const oxUI = new OxExperienceUI();

oxUI.init();
try {
  await oxExp.init();
  oxUI.hideLoadingScreen();
} catch (error) {
  switch (error.name) {
    case "INTERNAL_ERROR":
      oxUI.showError(
        "Internal Error",
        "An unespecified error has occurred. Your device might not be compatible with this experience."
      );
      break;
    case "CAMERA_ERROR":
      oxUI.showError(
        "Camera Error",
        "Could not access to your device's camera. Please, ensure you have given required permissions from your browser settings."
      );
      break;
    case "SENSORS_ERROR":
      oxUI.showError(
        "Sensors Error",
        "Could not access to your device's motion sensors. Please, ensure you have given required permissions from your browser settings."
      );
      break;
    case "LICENSE_ERROR":
      oxUI.showError(
        "License Error",
        "This experience does not exist or has been unpublished."
      );
  }
}
