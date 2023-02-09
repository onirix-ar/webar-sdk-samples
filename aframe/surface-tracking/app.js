// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.0.0/dist/ox-sdk.esm.js";

// ====== Onirix SDK ======

const OX = new OnirixSDK(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6MTQ0MjksInJvbGUiOjMsImlhdCI6MTYxNjc2MDI5M30.knKDX5vda6UyqB8CobqgPQ8BS7OYQo4RDfIuGm-EJGg"
);

var renderer, scene, camera, floor, raycaster, started;

AFRAME.registerComponent("onirix-sdk", {
    init: function () {
        renderer = this.el.renderer;
        scene = this.el.sceneEl;
        camera = document.getElementById("camera");
        camera.object3D.matrixAutoUpdate = false;
        floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                transparent: true,
                opacity: 0.0
            })
        );

        // Rotate floor to be horizontal and place it 1 meter below camera
        floor.rotateX(-Math.PI / 2);
        floor.position.set(0, -1, 0);
        floor.updateMatrixWorld(true);
        raycaster = new THREE.Raycaster();

        const config = {
            mode: OnirixSDK.TrackingMode.Surface,
            renderCanvas: this.el.canvas,
            disableWebXR: true
        };

        OX.init(config)
            .then((_) => {

                started = false;

                // Force resize to setup camera projection and renderer size
                onResize();

                // All loaded, so hide loading screen
                document.getElementById("loading-screen").style.display = "none";

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

            }).catch((error) => {

                console.error(error);

                // An error ocurred, chech error type and display it
                document.getElementById("loading-screen").style.display = 'none';

                switch (error.name) {

                    case 'INTERNAL_ERROR':
                        document.getElementById("error-title").innerText = 'Internal Error';
                        document.getElementById("error-message").innerText = 'An unespecified error has occurred. Your device might not be compatible with this experience.';
                        break;

                    case 'CAMERA_ERROR':
                        document.getElementById("error-title").innerText = 'Camera Error';
                        document.getElementById("error-message").innerText = 'Could not access to your device\'s camera. Please, ensure you have given required permissions from your browser settings.';
                        break;

                    case 'SENSORS_ERROR':
                        document.getElementById("error-title").innerText = 'Sensors Error';
                        document.getElementById("error-message").innerText = 'Could not access to your device\'s motion sensors. Please, ensure you have given required permissions from your browser settings.';
                        break;

                    case 'LICENSE_ERROR':
                        document.getElementById("error-title").innerText = 'License Error';
                        document.getElementById("error-message").innerText = 'This experience does not exist or has been unpublished.';
                        break;

                }

                document.getElementById("error-screen").style.display = 'flex';

            });
    }
});

function updatePose(pose) {
    // When a new pose is detected, update the 3D camera
    let modelViewMatrix = new THREE.Matrix4();
    modelViewMatrix = modelViewMatrix.fromArray(pose);
    camera.object3D.matrix = modelViewMatrix;
    camera.object3D.matrixWorldNeedsUpdate = true;
}

function onResize() {
    // When device orientation changes, it is required to update camera params.
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const cameraParams = OX.getCameraParameters();
    camera.object3DMap.camera.fov = cameraParams.fov;
    camera.object3DMap.camera.aspect = cameraParams.aspect;
    camera.object3DMap.camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onTouch(touchPos) {

    // Raycast
    raycaster.setFromCamera(touchPos, camera.object3DMap.camera);
    const intersects = raycaster.intersectObject(floor);
    if (intersects.length > 0) {
        const model = document.createElement("a-entity");
        model.setAttribute("gltf-model", "#bearModel");
        model.object3D.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
        // Model looking to the camera on Y axis
        //model.object3D.rotation.y = Math.atan2((camera.object3D.position.x - model.object3D.position.x), (camera.object3D.position.z - model.object3D.position.z));
        scene.appendChild(model);

        if (!started) {
            // Start tracking on first touch
            OX.start();
            started = true;
        }

    }

}

setTimeout(() => {
    AFRAME.scenes[0].setAttribute("onirix-sdk", "");
}, 1000);
