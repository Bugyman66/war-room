const { spawn } = require('child_process');

console.log('🚀 Booting up the Nigerian Political War Room v2.0 (Low-Memory Mode)...');

const runBackgroundLoop = process.argv.includes('--loop');

if (!runBackgroundLoop) {
  console.log('⚠️ Running background workers in ONE-SHOT mode to save memory. (Use --loop to run continuously)');
  
  // Run the data pipeline once before starting the servers
  const worker = spawn('npx', ['tsx', '--dns-result-order=ipv4first', 'local-dev.ts'], { 
    stdio: 'inherit', 
    shell: true,
    env: { ...process.env, RUN_ONCE: 'true' }
  });

  worker.on('close', code => {
    console.log(`[workers] Data pipeline finished. Booting servers...`);
    startServers();
  });
} else {
  // Original behavior: run everything concurrently
  const commands = [
    { name: 'workers', cmd: 'npx', args: ['tsx', '--dns-result-order=ipv4first', 'local-dev.ts'], color: '\x1b[35m' },
    { name: 'api', cmd: 'npm', args: ['run', 'dev:api'], color: '\x1b[36m' },
    { name: 'web', cmd: 'npm', args: ['run', 'dev:web'], color: '\x1b[32m' }
  ];
  startCommands(commands);
}

function startServers() {
  const commands = [
    { name: 'api', cmd: 'npm', args: ['run', 'dev:api'], color: '\x1b[36m' },
    { name: 'web', cmd: 'npm', args: ['run', 'dev:web'], color: '\x1b[32m' }
  ];
  startCommands(commands);
}

function startCommands(commands) {
  commands.forEach(c => {
    const child = spawn(c.cmd, c.args, { stdio: 'pipe', shell: true });

    child.stdout.on('data', data => {
      process.stdout.write(`${c.color}[${c.name}]\x1b[0m ${data}`);
    });

    child.stderr.on('data', data => {
      process.stderr.write(`${c.color}[${c.name}]\x1b[0m ${data}`);
    });
    
    child.on('close', code => {
      console.log(`${c.color}[${c.name}]\x1b[0m exited with code ${code}`);
    });
  });
}
