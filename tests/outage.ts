import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
export async function isolatedServer(){
  const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const address=socket.address();if(!address||typeof address==='string')throw new Error('No test port');const port=address.port;
  await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
  const server=spawn('bun',['build/index.js'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Isolated server startup timed out')),10000);server.stdout.on('data',chunk=>{if(String(chunk).includes('Listening')){clearTimeout(timer);resolve();}});server.on('error',reject);server.on('exit',code=>{clearTimeout(timer);if(code)reject(new Error(`Server exited ${code}`));});});
  return {url:`http://127.0.0.1:${port}`,stop:()=>new Promise<void>(resolve=>{if(server.exitCode!==null||server.signalCode!==null){resolve();return;}server.once('exit',()=>resolve());server.kill('SIGTERM');})};
}
