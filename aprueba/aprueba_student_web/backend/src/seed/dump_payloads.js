// Volcado de respuestas reales del API para validar los modelos del cliente
// Flutter (aprueba_app/tool/check_models.py). Requiere la base sembrada.
//   node src/seed/dump_payloads.js [salida.json]
process.env.PHONE_AUTH_ALLOW_DEV_TOKEN = 'true';
process.env.PORT = process.env.DUMP_PORT || '4210';
await import('../index.js');
const B = `http://127.0.0.1:${process.env.PORT}/api/v1`;
await new Promise(r=>setTimeout(r,400));
const call=async(m,p,{token,body}={})=>{
  const r=await fetch(B+p,{method:m,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const t=await r.text();
  try{return JSON.parse(t);}catch{return {raw:t};}
};
const login=async(e)=>(await call('POST','/auth/login',{body:{email:e,password:'demo1234'}}));
const premiumLogin=await login('camila@correo.cl');
const premium=premiumLogin.data.accessToken;
const out={};
out['AuthSession']=premiumLogin;
out['PhoneCodeHint']=await call('POST','/auth/phone/send-code',{body:{phone:'+56911223344'}});
out['PhoneVerification']=await call('POST','/auth/phone/verify-code',{body:{firebaseIdToken:'dev:+56911223344'}});
out['Country']=await call('GET','/countries');
out['GradeGroup']=await call('GET','/countries/CL/grades');
out['TestInfo']=await call('GET','/tests?gradeId=cl-paes',{token:premium});
out['User']=await call('GET','/me',{token:premium});
out['Preferences']=await call('GET','/me/preferences',{token:premium});
out['TutorCard']=await call('GET','/tutors',{token:premium});
out['TutorDetail']=await call('GET','/tutors/tut_maria',{token:premium});
out['TutorReviewPage']=await call('GET','/tutors/tut_maria/reviews',{token:premium});
// Responde 4 preguntas para que el analisis tenga ejes con datos.
for(let i=0;i<4;i++){
  const q=await call('GET','/practice/next',{token:premium});
  if(!q?.data?.id) break;
  await call('POST',`/questions/${q.data.id}/answer`,{token:premium,body:{selected:'A',elapsedMs:12000}});
}
out['GapAnalysis']=await call('GET','/me/gap-analysis',{token:premium});
out['ContactRequestResult']=await call('POST','/tutors/tut_paula/contact-requests',{token:premium,body:{message:'Hola Paula, necesito reforzar biologia celular.'}});
out['Conversation']=await call('GET','/me/conversations',{token:premium});
const convId=out['Conversation'].data[0].id;
out['ConversationDetail']=await call('GET',`/conversations/${convId}`,{token:premium});
out['ChatMessage']=await call('GET',`/conversations/${convId}/messages`,{token:premium});
out['PublishedReview']=await call('POST','/tutors/tut_paula/reviews',{token:premium,body:{ratings:{teaching:5,punctuality:4,mastery:5},comment:'Clara y puntual'}});
out['ContactSharing']=await call('PATCH',`/conversations/${convId}/contact-sharing`,{token:premium,body:{shareWhatsapp:true}});
const fs=await import('fs');
const target = process.argv[2] || 'payloads.json';
fs.writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`[dump] ${Object.keys(out).length} respuestas -> ${target}`);
process.exit(0);
