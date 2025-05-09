const { Command } = require('commander');
const program = new Command();

const API_ENDPOINT = 'http://localhost:8080';

async function getExerciseData() {
  const response = await fetch(API_ENDPOINT + '/exercises');
  if (!response.ok) {
    throw new Error('Error fetching exercise data: ' + response.statusText);
  }
  return await response.json();
}

async function getRoverConfig() {
  const response = await fetch(API_ENDPOINT + '/rover/config');
  if (!response.ok) {
    throw new Error('Error fetching rover config: ' + response.statusText);
  }
  return await response.json();
}

program
  .name('rovercli')
  .description('CLI for TOP SECRET NASA  rover stuff')
  .version('1.0.0');

program.command('health')
  .description('Checks the health of the rover api')
  .action(async (str, options) => {
    console.log('Checking rover api health');

    const response = await fetch(API_ENDPOINT + '/health');

    if (response.status !== 418) {
      console.error('Error fetching rover api health:', response.statusText);
      return;
    }
    // It is indeed a teapot
    console.log(response.statusText);
  });

program.command('rover')
  .description('Fetches the rover config from the API')
  .action(async (str, options) => {
    console.log('Fetching rover config');

    const data = await getRoverConfig();
    if (!data) {
      console.error('Error fetching rover config');
      return;
    }
    console.log('Rover config:', data);
  });

program.command('exercise')
  .description('Fetches the exercise data from the API')
  .action(async (str, options) => {
    console.log('Fetching exercise data');

    const data = await getExerciseData();
    if (!data) {
      console.error('Error fetching exercise data');
      return;
    }
    console.log('Exercise data:', data);
  });


program.command('fixed-distance')
  .description('Moves the rover by a fixed distance retrieved from the excercise api endpoint')
  .action(async (str, options) => {
    console.log('Moving rover by fixed distance');


    const exerciseData = await getExerciseData();
    if (!exerciseData) {
      console.error('Error fetching exercise data');
      return;
    }

    if (!exerciseData.fixed_distance) {
      console.error('Error: fixed_distance not found in exercise data');
      return;
    }

    if (!exerciseData.fixed_distance.value) {
      console.error('Error: fixed_distance.value not found in exercise data');
      return;
    }

    const roverData = await getRoverConfig();
    if (!roverData) {
      console.error('Error fetching rover config');
      return;
    }

    const motors = roverData.motors;

    const fixedDistance = exerciseData.fixed_distance.value;

    console.log('Fixed distance:', fixedDistance);

    if (!roverData.batteries || roverData.batteries.length === 0) {
      console.error('Error: No batteries found in rover data');
      return;
    }

    const batteryMaxVoltage = roverData.batteries[0].max_voltage;
    console.log('Battery max voltage:', batteryMaxVoltage);

    const maxWheelSpeeds = motors.map(motor => {
      const kvRating = motor.kv_rating;
      const wheel = motor.wheel;
      const wheelDiameter = wheel.diameter;
      const gearRatio = wheel.gear_ratio;

      // We NEED to calculate this based on the battery's max voltage
      // and the motor's kv rating for an optimal solution
      const maxMotorSpeed = kvRating * batteryMaxVoltage;

      // We need to get the max wheel speed based on the motor's max speed
      // and the gear ratio for an optimal solution
      const maxWheelSpeed = (maxMotorSpeed / gearRatio) * (Math.PI * wheelDiameter / 60);

      return maxWheelSpeed;
    });

    // We need the minimum wheel speed to ensure all 
    // wheels are moving at the same speed
    const finalMaxWheelSpeed = Math.min(...maxWheelSpeeds);
    const duration = fixedDistance / finalMaxWheelSpeed;

    console.log('Final max wheel speed:', finalMaxWheelSpeed);

    const motorCommands = roverData.motors.map(motor => {
      const kvRating = motor.kv_rating;
      const wheel = motor.wheel;
      const wheelDiameter = wheel.diameter;
      const gearRatio = wheel.gear_ratio;

      // Calculate motor speed (RPM) for the optimal wheel speed
      const motorSpeed = (finalMaxWheelSpeed * gearRatio * 60) / (Math.PI * wheelDiameter);
      
      // Calculate voltage (V) for the motor
      const voltage = motorSpeed / kvRating;

      return {
        name: motor.name,
        voltage: voltage
      };
    });

    const command = {
      duration: duration,
      motor_commands: motorCommands
    };

    console.log('Command: ', command);

    const response = await fetch(API_ENDPOINT + '/verify/fixed_distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });

    console.log('Response status:', response.status);

    const result = await response.text();
    console.log('API Response:', result);


  });

program.parse();