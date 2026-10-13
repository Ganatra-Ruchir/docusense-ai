/** Promise bridge: model downloads and inference execute off the UI thread. */
export const env={};
let worker=null,sequence=0;
const pending=new Map();
function failWorker(error){for(const request of pending.values()){clearTimeout(request.timeout);request.reject(error);}pending.clear();if(worker)worker.terminate();worker=null;}
function getWorker(){
 if(worker)return worker;
 worker=new Worker(new URL('./inference-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{const request=pending.get(data.id);if(!request)return;if(data.kind==='progress'){request.progress?.(data.progress);return;}pending.delete(data.id);clearTimeout(request.timeout);data.error?request.reject(new Error(data.error)):request.resolve(data.result);};
 worker.onerror=event=>failWorker(new Error(event.message||'Inference worker could not start. Check network access and retry.'));
 return worker;
}
function request(payload,progress){return new Promise((resolve,reject)=>{const id=++sequence;let active;try{active=getWorker();}catch(error){reject(error);return;}const timeout=setTimeout(()=>failWorker(new Error('Model operation timed out. Check the connection and retry.')),180000);pending.set(id,{resolve,reject,progress,timeout});try{active.postMessage({...payload,id});}catch(error){pending.delete(id);clearTimeout(timeout);reject(error);}});}
export async function pipeline(task,model,options={}){
 const progress=options.progress_callback;
 await request({kind:'load',task,model},progress);
 return (...inputs)=>request({kind:'infer',task,model,inputs},progress);
}
