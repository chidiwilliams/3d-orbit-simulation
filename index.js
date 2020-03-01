import * as dat from 'dat.gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

(function() {
  // Adapted from https://evgenii.com/files/2016/09/earth_orbit_simulation/the_complete_code/
  const physics = (function() {
    const constants = {
      gravitationalConstant: 6.67408 * Math.pow(10, -11),
      earthSunDistanceMeters: 1.496 * Math.pow(10, 11),
      earthAngularVelocityMetersPerSecond: 1.990986 * Math.pow(10, -7),
      massOfTheSunKg: 1.98855 * Math.pow(10, 30), // same as mass of sun
    };

    // The length of one AU (Earth-Sun distance) in screen dimensions.
    const pixelsInOneEarthSunDistancePerPixel = 10;

    // A factor by which we scale the distance between the Sun and the Earth
    // in order to show it on screen
    const scaleFactor =
      constants.earthSunDistanceMeters / pixelsInOneEarthSunDistancePerPixel;

    // The number of calculations of orbital path done in one 16 millisecond frame.
    // The higher the number, the more precise are the calculations and the slower the simulation.
    const numberOfCalculationsPerFrame = 1000;

    // The length of the time increment, in seconds.
    const deltaT = (3000 * 24) / numberOfCalculationsPerFrame;

    // Rotation of earth (in radians) in one 16 millisecond frame.
    const earthRotation = 0.05;

    // Rotation of sun (in radians) in one 16 millisecond frame.
    const sunRotation = 0.01;

    const initialConditions = {
      distance: {
        value: 1.496 * Math.pow(10, 11), // 1 AU
        speed: 0.0,
      },
      angle: {
        value: Math.PI / 6, // arbitrary
        speed: 1.990986 * Math.pow(10, -7),
      },
    };

    const state = {
      distance: { value: 0, speed: 0 },
      angle: { value: 0, speed: 0 },
      massOfTheSunKg: constants.massOfTheSunKg,
      paused: false,
    };

    function calculateDistanceAcceleration(state) {
      return (
        state.distance.value * Math.pow(state.angle.speed, 2) -
        (constants.gravitationalConstant * state.massOfTheSunKg) /
          Math.pow(state.distance.value, 2)
      );
    }

    function calculateAngleAcceleration(state) {
      return (
        (-2.0 * state.distance.speed * state.angle.speed) / state.distance.value
      );
    }

    function newValue(currentValue, deltaT, derivative) {
      return currentValue + deltaT * derivative;
    }

    function resetStateToInitialConditions() {
      state.distance.value = initialConditions.distance.value;
      state.distance.speed = initialConditions.distance.speed;

      state.angle.value = initialConditions.angle.value;
      state.angle.speed = initialConditions.angle.speed;
    }

    // The distance that is used for drawing on screen
    function scaledDistance() {
      return state.distance.value / scaleFactor;
    }

    // The main function that is called on every animation frame.
    // It calculates and updates the current positions of the bodies
    function updatePosition() {
      if (physics.state.paused) {
        return;
      }
      for (let i = 0; i < numberOfCalculationsPerFrame; i++) {
        calculateNewPosition();
      }
    }

    // Calculates position of the earth
    function calculateNewPosition() {
      // Calculate new distance
      const distanceAcceleration = calculateDistanceAcceleration(state);
      state.distance.speed = newValue(
        state.distance.speed,
        deltaT,
        distanceAcceleration,
      );
      state.distance.value = newValue(
        state.distance.value,
        deltaT,
        state.distance.speed,
      );

      // Calculate new angle
      const angleAcceleration = calculateAngleAcceleration(state);
      state.angle.speed = newValue(
        state.angle.speed,
        deltaT,
        angleAcceleration,
      );
      state.angle.value = newValue(
        state.angle.value,
        deltaT,
        state.angle.speed,
      );

      if (state.angle.value > 2 * Math.PI) {
        state.angle.value = state.angle.value % (2 * Math.PI);
      }
    }

    // Updates the mass of the Sun
    function updateFromUserInput(sunMassMultiplier) {
      state.massOfTheSunKg = constants.massOfTheSunKg * sunMassMultiplier;
    }

    return {
      scaledDistance,
      resetStateToInitialConditions,
      updatePosition,
      initialConditions,
      updateFromUserInput,
      state,
      earthRotation,
      sunRotation,
    };
  })();

  const graphics = (function() {
    let scene, camera, earth, sun, renderer, controls, orbit;
    let previousEarthPositionWithOrbitPoint = null;
    const maxNumberOfOrbitVertices = 1000;

    function init(onChangeSunMassMultiplier) {
      scene = new THREE.Scene();
      scene.background = THREE.ImageUtils.loadTexture('textures/2k_stars.jpg');

      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000);

      controls = new OrbitControls(camera, renderer.domElement);

      document.body.appendChild(renderer.domElement);

      const earthTexture = THREE.ImageUtils.loadTexture(
        'textures/2k_earth_daymap.jpg',
      );
      earth = createSphere(0.25, 0, 0, earthTexture);
      scene.add(earth);

      const sunTexture = THREE.ImageUtils.loadTexture('textures/2k_sun.jpg');
      sun = createSphere(1, 0, 0, sunTexture);
      scene.add(sun);

      camera.position.z = 15;
      camera.position.y = 5;

      const sunLight = new THREE.PointLight(0xffffff, 2, 50);
      scene.add(sunLight);

      const ambientLight = new THREE.AmbientLight();
      scene.add(ambientLight);

      orbit = createOrbit([]);
      scene.add(orbit);

      initDatGUI(onChangeSunMassMultiplier);
    }

    function createOrbit(vertices) {
      const material = new THREE.LineBasicMaterial({ color: 0xffffff });
      const geometry = new THREE.Geometry();
      geometry.vertices = vertices;
      return new THREE.Line(geometry, material);
    }

    function createSphere(radius, x, y, texture) {
      const geometry = new THREE.SphereGeometry(radius, 200, 200);
      const material = new THREE.MeshPhongMaterial({
        map: texture,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = x;
      mesh.position.y = y;
      return mesh;
    }

    function initDatGUI(onChangeSunMassMultiplier) {
      const guiParams = { sunMassMultiplier: 1 };
      const gui = new dat.GUI();
      gui
        .add(guiParams, 'sunMassMultiplier', 0, 3)
        .name('Mass of the sun')
        .setValue(1)
        .listen()
        .onChange(onChangeSunMassMultiplier);
      gui.open();
    }

    function calculateEarthPosition(distance, angle) {
      const x = Math.cos(angle) * distance;
      const y = Math.sin(-angle) * distance;
      return new THREE.Vector2(x, y);
    }

    function drawScene(distance, angle, earthRotation, sunRotation) {
      const xyEarthPosition = calculateEarthPosition(distance, angle);
      const earthPosition = normalizeEarthPosition(xyEarthPosition);
      drawEarth(earthPosition, earthRotation);
      drawSun(sunRotation);
      drawOrbit(earthPosition);

      renderer.render(scene, camera);
      controls.update();
    }

    function normalizeEarthPosition(earthPosition) {
      return new THREE.Vector3(earthPosition.x, 0, earthPosition.y);
    }

    function drawEarth(earthPosition, earthRotation) {
      earth.position.x = earthPosition.x;
      earth.position.z = earthPosition.z;
      earth.rotation.y += earthRotation;
    }

    function drawSun(sunRotation) {
      sun.rotation.y += sunRotation;
    }

    function drawOrbit(earthPosition) {
      if (previousEarthPositionWithOrbitPoint === null) {
        previousEarthPositionWithOrbitPoint = earthPosition;
      } else {
        const distance = earthPosition.distanceToSquared(
          previousEarthPositionWithOrbitPoint,
        );
        if (distance > 0.2) {
          const vertices = orbit.geometry.vertices;
          vertices.push(earthPosition);
          if (vertices.length === maxNumberOfOrbitVertices) {
            vertices.shift();
          }
          scene.remove(orbit);
          orbit = createOrbit(vertices);
          scene.add(orbit);
          previousEarthPositionWithOrbitPoint = earthPosition;
        }
      }
    }

    function updateSunSize(sliderValue) {
      sun.geometry.dispose();
      sun.geometry = new THREE.SphereGeometry(sliderValue, 15, 15);
    }

    return { drawScene, updateSunSize, init };
  })();

  const simulation = (function() {
    function animate() {
      physics.updatePosition();
      graphics.drawScene(
        physics.scaledDistance(),
        physics.state.angle.value,
        physics.earthRotation,
        physics.sunRotation,
      );
      requestAnimationFrame(animate);
    }

    function sunt() {
      graphics.init(onChangeSunMassMultiplier);
      physics.resetStateToInitialConditions();
      animate();
    }

    function onChangeSunMassMultiplier(sunMassMultiplier) {
      physics.updateFromUserInput(sunMassMultiplier);
      graphics.updateSunSize(sunMassMultiplier);
    }

    return { sunt };
  })();

  simulation.sunt();
})();
