// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.6.5/dist/ox-sdk.esm.js";
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader.js";

class OxExperience {

    _renderer = null;
    _scene = null;
    _camera = null;
    _shadowPlane = null;
    _model = null;
    _envMap = null;
    _isModelPlaced = false;
    
    _hitResultListener = null;

    oxSDK;

    async init() {
        const renderCanvas = await this.initSDK();
        this.setupRenderer(renderCanvas);

        this.oxSDK.subscribe(OnirixSDK.Events.OnFrame, () => {
            this.render();
        })

        this.oxSDK.subscribe(OnirixSDK.Events.OnPose, (pose) => {
            this.updatePose(pose);
        });
    
        this.oxSDK.subscribe(OnirixSDK.Events.OnResize, () => {
            this.onResize();
        });
    
        this.oxSDK.subscribe(OnirixSDK.Events.OnHitTestResult, (hitResult) => {
            this.onHitResult(hitResult);
        });

        this._model = await this.loadModel("van-gogh-room-portal.glb");
        // disable colorWrite on room wrapper mesh to create portal illusion
        this._model.traverse((object) => {
            if (object.isMesh) {
                if (object.userData.occlusion) {
                    object.material.colorWrite = false;
                    object.material.side = THREE.DoubleSide;
                }
            }
        });
        this._model.visible = false;
        this._scene.add(this._model);

    }

    async initSDK() {
        this.oxSDK = new OnirixSDK("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6MTQ0MjgsInJvbGUiOjMsImlhdCI6MTYxNjc1ODY5NX0.8F5eAPcBGaHzSSLuQAEgpdja9aEZ6Ca_Ll9wg84Rp5k");
        const config = {
            mode: OnirixSDK.TrackingMode.Surface
        }
        return this.oxSDK.init(config);
    }

    setupRenderer(renderCanvas) {
        const width = renderCanvas.width;
        const height = renderCanvas.height;
    
        // Initialize renderer with renderCanvas provided by Onirix SDK
        this._renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, alpha: true });
        this._renderer.setClearColor(0x000000, 0);
        this._renderer.setSize(width, height);
        this._renderer.outputEncoding = THREE.sRGBEncoding;
    
        // Ask Onirix SDK for camera parameters to create a 3D camera that fits with the AR projection.
        const cameraParams = this.oxSDK.getCameraParameters();
        this._camera = new THREE.PerspectiveCamera(cameraParams.fov, cameraParams.aspect, 0.1, 1000);
        this._camera.matrixAutoUpdate = false;
    
        // Create an empty scene
        this._scene = new THREE.Scene();
    
        // Add some lights
        const hemisphereLight = new THREE.HemisphereLight(0xbbbbff, 0x444422);
        this._scene.add(hemisphereLight);
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
        directionalLight.position.set(2, 10, 0);
        this._scene.add(directionalLight);

        // Load env map
        const textureLoader = new THREE.TextureLoader();
        this._envMap = textureLoader.load('envmap.jpg');
	    this._envMap.mapping = THREE.EquirectangularReflectionMapping;
        this._envMap.encoding = THREE.sRGBEncoding;

        // Add transparent floor to project shadows
        this._shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                transparent: true,
                opacity: 0.0,
                side: THREE.DoubleSide
            })
        );
  
        // Rotate floor to be horizontal
        this._shadowPlane.rotateX(Math.PI / 2)
    }

    render() {
        this._renderer.render(this._scene, this._camera);
    }

    updatePose(pose) {
        // When a new pose is detected, update the 3D camera
        let modelViewMatrix = new THREE.Matrix4();
        modelViewMatrix = modelViewMatrix.fromArray(pose);
        this._camera.matrix = modelViewMatrix;
        this._camera.matrixWorldNeedsUpdate = true;
    }

    onResize() {
        // When device orientation changes, it is required to update camera params.
        const width = this._renderer.domElement.width;
        const height = this._renderer.domElement.height;
        const cameraParams = this.oxSDK.getCameraParameters();
        this._camera.fov = cameraParams.fov;
        this._camera.aspect = cameraParams.aspect;
        this._camera.updateProjectionMatrix();
        this._renderer.setSize(width, height);
    }

    onHitResult(hitResult) {
        if (this._model && !this._isModelPlaced) {
            if (this._hitResultListener) {
                this._hitResultListener();
            }
            this._model.visible = true;
            this._model.position.copy(hitResult.position);
            this._model.setRotationFromQuaternion(hitResult.rotation);
        }
    }

    async loadModel(uri) {
       const gltfLoader = new GLTFLoader();
       return new Promise((resolve, reject) => {
           gltfLoader.load(uri, (gltf) => {
               resolve(gltf.scene);
           }, undefined, (error) => reject(error));
       });
    }

    placeModel() {
        this.oxSDK.start();
        this._isModelPlaced = true;
    }

    setOnHitResultListener(listener) {
        this._hitResultListener = listener;
    }

}


class OxExperienceUI {

    _loadingScreen = null;
    _errorScreen = null;
    _moveAnimation = null;
    _errorTitle = null;
    _errorMessage = null;
    _placeButton = null;

    _playButtonClickListener = null;

    init() {
        this._loadingScreen = document.querySelector("#loading-screen");
        this._errorScreen = document.querySelector("#error-screen");
        this._errorTitle = document.querySelector("#error-title");
        this._errorMessage = document.querySelector("#error-message");
        this._moveAnimation = document.querySelector("#move-around-animation");
        this._placeButton = document.querySelector("#tap-to-place");
        this._placeButton.addEventListener('click', () => {
            if (this._playButtonClickListener) {
                this._playButtonClickListener();
            }
        });
    }

    setOnPlaceButtonClickListener(listener) {
        this._playButtonClickListener = listener;
    }

    hideLoadingScreen() {
        this._loadingScreen.style.display = 'none';
    }

    showPlaceButton() {
        this._placeButton.style.display = 'block';
    }

    hidePlaceButton() {
        this._placeButton.style.display = 'none';
    }

    showMoveAnimation() {
        this._moveAnimation.style.display = 'block';
    }

    hideMoveAnimation() {
        this._moveAnimation.style.display = 'none';
    }

    showError(errorTitle, errorMessage) {
        this._errorTitle.innerText = errorTitle;
        this._errorMessage.innerText = errorMessage;
        this._errorScreen.style.display = 'flex';
    }

}

const oxExp = new OxExperience();
const oxUI = new OxExperienceUI();

oxUI.init();
try {
    await oxExp.init();
    oxExp.setOnHitResultListener(() => {
        oxUI.hideMoveAnimation();
    });
    oxUI.setOnPlaceButtonClickListener(() => {
        oxExp.placeModel();
        oxUI.hidePlaceButton();
    });
    oxUI.hideLoadingScreen();
    oxUI.showMoveAnimation();
    oxUI.showPlaceButton();
} catch (error) {
    switch (error.name) {
        case 'INTERNAL_ERROR':
            oxUI.showError('Internal Error', 'An unespecified error has occurred. Your device might not be compatible with this experience.');
            break;
        case 'CAMERA_ERROR':
            oxUI.showError('Camera Error', 'Could not access to your device\'s camera. Please, ensure you have given required permissions from your browser settings.');
            break;
        case 'SENSORS_ERROR':
            oxUI.showError('Sensors Error', 'Could not access to your device\'s motion sensors. Please, ensure you have given required permissions from your browser settings.');
            break;
        case 'LICENSE_ERROR':
            oxUI.showError('License Error', 'This experience does not exist or has been unpublished.');
    }
}
