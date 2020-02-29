import * as dat from 'dat.gui';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

(function() {
  // Adapted from https://evgenii.com/files/2016/09/earth_orbit_simulation/the_complete_code/
  const physics = (function() {
    const constants = {
      gravitationalConstant: 6.67408 * Math.pow(10, -11),
      planetStarDistanceMeters: 1.496 * Math.pow(10, 11), // distance from earth to sun
      planetAngularVelocityMetersPerSecond: 1.990986 * Math.pow(10, -7), // same as Earth's
      massOfTheStarKg: 1.98855 * Math.pow(10, 30), // same as mass of sun
    };

    // The length of one AU (Earth-Sun distance) in screen dimensions.
    const pixelsInOneEarthSunDistancePerPixel = 20;

    // A factor by which we scale the distance between the Sun and the Earth
    // in order to show it on screen
    const scaleFactor =
      constants.planetStarDistanceMeters / pixelsInOneEarthSunDistancePerPixel;

    // The number of calculations of orbital path done in one 16 millisecond frame.
    // The higher the number, the more precise are the calculations and the slower the simulation.
    const numberOfCalculationsPerFrame = 1000;

    // The length of the time increment, in seconds.
    const deltaT = (3600 * 24) / numberOfCalculationsPerFrame;

    // Rotation of planet (in radians) in one 16 millisecond frame.
    const planetRotation = 0.05;

    // Rotation of star (in radians) in one 16 millisecond frame.
    const starRotation = -0.01;

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
      massOfTheStarKg: constants.massOfTheStarKg,
      paused: false,
    };

    function calculateDistanceAcceleration(state) {
      return (
        state.distance.value * Math.pow(state.angle.speed, 2) -
        (constants.gravitationalConstant * state.massOfTheStarKg) /
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

    // Calculates position of the planet
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

    // Updates the mass of the Star
    function updateFromUserInput(starMassMultiplier) {
      state.massOfTheStarKg = constants.massOfTheStarKg * starMassMultiplier;
    }

    return {
      scaledDistance,
      resetStateToInitialConditions,
      updatePosition,
      initialConditions,
      updateFromUserInput,
      state,
      planetRotation,
      starRotation,
    };
  })();

  const graphics = (function() {
    let scene, camera, planet, star, renderer, controls;

    function init(onChangeStarMassMultiplier) {
      scene = new THREE.Scene();
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

      planet = createSphere(0.25, 0, 0);
      scene.add(planet);

      star = createSphere(1, 0, 0);
      scene.add(star);

      camera.position.z = 27;
      camera.position.y = 10;

      initDatGUI(onChangeStarMassMultiplier);
    }

    function createSphere(radius, x, y) {
      const geometry = new THREE.SphereGeometry(radius, 15, 15);
      const line = new THREE.LineSegments(geometry);
      line.material.depthTest = false;
      line.material.transparent = false;
      line.position.x = x;
      line.position.y = y;
      return line;
    }

    function initDatGUI(onChangeStarMassMultiplier) {
      const guiParams = { starMassMultiplier: 1 };
      const gui = new dat.GUI();
      gui
        .add(guiParams, 'starMassMultiplier', 0, 3)
        .name('Mass of the star')
        .setValue(1)
        .listen()
        .onChange(onChangeStarMassMultiplier);
      gui.open();
    }

    function calculatePlanetPosition(distance, angle) {
      const x = Math.cos(angle) * distance;
      const y = Math.sin(-angle) * distance;
      return { x, y };
    }

    function drawScene(distance, angle, planetRotation, starRotation) {
      const planetPosition = calculatePlanetPosition(distance, angle);
      drawPlanet(planetPosition, planetRotation);
      drawStar(starRotation);

      renderer.render(scene, camera);
      controls.update();
    }

    function drawPlanet(planetPosition, planetRotation) {
      planet.position.x = planetPosition.x;
      planet.position.z = planetPosition.y;
      planet.rotation.y += planetRotation;
    }

    function drawStar(starRotation) {
      star.rotation.y += starRotation;
    }

    function updateSunSize(sliderValue) {
      star.geometry.dispose();
      star.geometry = new THREE.SphereGeometry(sliderValue, 15, 15);
    }

    return { drawScene, updateSunSize, init };
  })();

  const simulation = (function() {
    function animate() {
      physics.updatePosition();
      graphics.drawScene(
        physics.scaledDistance(),
        physics.state.angle.value,
        physics.planetRotation,
        physics.starRotation,
      );
      requestAnimationFrame(animate);
    }

    function start() {
      graphics.init(onChangeStarMassMultiplier);
      physics.resetStateToInitialConditions();
      animate();
    }

    function onChangeStarMassMultiplier(starMassMultiplier) {
      physics.updateFromUserInput(starMassMultiplier);
      graphics.updateSunSize(starMassMultiplier);
    }

    return { start };
  })();

  simulation.start();
})();
