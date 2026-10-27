import http from 'node:http';
import {readFile} from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"status":"ok","mode":"demo"}');}
 const file=path==='/'?'/index.html':path;
 if(!['/index.html','/style.css','/app.js'].includes(file)){res.writeHead(404);return res.end('Not found');}
 try{const data=await readFile(new URL('./public'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.slice(file.lastIndexOf('.'))],'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('Unable to load application');}
}).listen(process.env.PORT||3000,'0.0.0.0');
