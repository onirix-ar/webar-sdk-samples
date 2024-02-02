// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.6.2/dist/ox-sdk.esm.js";
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/GLTFLoader.js";

class OxExperience {

    _renderer = null;
    _scene = null;
    _camera = null;
    _model = null;
    
    oxSDK;

    async init() {
        this._raycaster = new THREE.Raycaster();

        const renderCanvas = await this.initSDK();
        this.setupRenderer(renderCanvas);

        this.oxSDK.subscribe(OnirixSDK.Events.OnDetected, () => {
            console.log("Detected!")
            this._model.scale.set(0.15, 0.15, 0.15);
            this._model.rotation.y = Math.PI / 4;
            this._model.position.copy(new THREE.Vector3(-0.0905, 0.0686, -0.11));
            this._scene.add(this._model);

            const textureLoader = new THREE.TextureLoader();
            this._manualTexture = textureLoader.load("textures/manual.png");    
            this._webpageTexture = textureLoader.load("textures/webpage.png");    

            this._buttonManual = new THREE.Mesh(
                new THREE.PlaneGeometry(0.15, 0.075),
                new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    transparent: true,
                    map: this._manualTexture
                })
            );
            this._buttonManual.position.copy(new THREE.Vector3(-0.085, 0.2, 0.09));
            this._buttonManual.rotation.y = Math.PI / 2;
            this._scene.add(this._buttonManual);

            this._buttonWebpage = new THREE.Mesh(
                new THREE.PlaneGeometry(0.15, 0.075),
                new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    transparent: true,
                    map: this._webpageTexture
                })
            );
            this._buttonWebpage.position.copy(new THREE.Vector3(-0.085, 0.3, 0.09));
            this._buttonWebpage.rotation.y = Math.PI / 2;
            this._scene.add(this._buttonWebpage);

            // It is useful to synchronize scene background with the camera feed
            this._scene.background = new THREE.VideoTexture(this.oxSDK.getCameraFeed());
        })

        this.oxSDK.subscribe(OnirixSDK.Events.OnTouch, (touchPos) => {
            this.onTouch(touchPos);
        })

        this.oxSDK.subscribe(OnirixSDK.Events.OnLost, () => {
            this._scene.remove(this._model);
            // It is useful to synchronize scene background with the camera feed
            this._scene.background = null;
        })

        this.oxSDK.subscribe(OnirixSDK.Events.OnFrame, () => {
            this.render();
        })

        this.oxSDK.subscribe(OnirixSDK.Events.OnPose, (pose) => {
            this.updatePose(pose);
        });
    
        this.oxSDK.subscribe(OnirixSDK.Events.OnResize, () => {
            this.onResize();
        });

        this._model = await this.loadModel("caesar.glb");

        this.oxSDK.start();
    }

    async initSDK() {
        this.oxSDK = new OnirixSDK("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6Njg3NDcsInJvbGUiOjMsImlhdCI6MTcwNjI4MzQ2MX0.9b2dqUXoq23UDs9uRaKWd60FHMbj6OP27NW5nJpFL3M");
        const config = {
            mode: OnirixSDK.TrackingMode.Spatial,
            sceneOid: "742418478df44f80887ca24ca163dd13",
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
          
        // Ask Onirix SDK for camera parameters to create a 3D camera that fits with the AR projection.
        const cameraParams = this.oxSDK.getCameraParameters();
        this._camera = new THREE.PerspectiveCamera(cameraParams.fov, cameraParams.aspect, 0.1, 1000);
        this._camera.matrixAutoUpdate = false;
    
        // Create an empty scene
        this._scene = new THREE.Scene();
    
        // Add some lights
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
        this._scene.add(ambientLight);
        const hemisphereLight = new THREE.HemisphereLight(0xbbbbff, 0x444422);
        this._scene.add(hemisphereLight);
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

    onTouch(touchPos) {
        // Raycast
        this._raycaster.setFromCamera(touchPos, this._camera);
        let intersects = this._raycaster.intersectObject(this._buttonManual);

        if (intersects.length > 0 && intersects[0].object == this._buttonManual) {
            window.open('https://czechgames.com/files/rules/through-the-ages-new-story-handbook-en.pdf')
        }

        intersects = this._raycaster.intersectObject(this._buttonWebpage);

        if (intersects.length > 0 && intersects[0].object == this._buttonWebpage) {
            window.open('https://czechgames.com/en/through-the-ages/')
        }
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

    async loadModel(uri) {
       const gltfLoader = new GLTFLoader();
       return new Promise((resolve, reject) => {
           gltfLoader.load(uri, (gltf) => {
               resolve(gltf.scene);
           }, undefined, (error) => reject(error));
       });
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
        this._loadingScreen.style.display = 'none';
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
    oxUI.hideLoadingScreen();
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
