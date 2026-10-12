import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels=false;
const models=new Map();
function getPipeline(task,model,id){const key=task+'|'+model;if(!models.has(key)){const loading=pipeline(task,model,{quantized:true,progress_callback:progress=>self.postMessage({id,kind:'progress',progress})}).catch(error=>{models.delete(key);throw error;});models.set(key,loading);}return models.get(key);}
self.onmessage=async({data})=>{try{const run=await getPipeline(data.task,data.model,data.id);let result=true;if(data.kind==='infer'){result=await run(...data.inputs);if(data.task==='feature-extraction')result={data:Array.from(result.data)};}self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error?.message||'Model operation failed.'});}};
