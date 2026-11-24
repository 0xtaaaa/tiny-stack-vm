import{mkdirSync as m,readFileSync as r,readdirSync as d,writeFileSync as w}from'node:fs';
import{join as j}from'node:path';
const T=Buffer.from('AUNJEZGh4fEAAAAAAAAAAGFhYWFhYWFRYWFhUWFhYQBhYWEAAAAAAAAAAAAAAAAABRUVBQEAAAAAAAAAAAAAAFEhAAAAAAAAAAAAAAAAAAAREUER','base64');
const R=(p:Uint8Array,I:Uint8Array)=>{
const n=p.length,D=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),O=new Uint8Array(65536);
let s=0,c=0,o=0,i=0,q=0,k=0;
const e=(x:number)=>({o:O.subarray(0,o),c:x});
for(;;){
if(k++==1e6)return e(10);
if(q<0||q>=n)return e(9);
const y=p[q],u=T[y];
if(!u)return e(5);
const h=u>>1&7,g=u>>4&3,f=u>>6&3;
if(q+h>=n)return e(9);
const t=q+1+h;
if(s<g)return e(2);
if(s-g+f>256)return e(3);
q=t;
switch(y){
case 0:return e(0);
case 1:D[s++]=p[t-1]<<24>>24;break;
case 2:D[s++]=p[t-4]|p[t-3]<<8|p[t-2]<<16|p[t-1]<<24;break;
case 3:case 4:case 5:case 6:case 7:y==3?s--:y%2?(y>5&&([D[s-3],D[s-2]]=[D[s-2],D[s-3]]),[D[s-2],D[s-1]]=[D[s-1],D[s-2]]):(D[s]=D[s-(y/2-1)],s++);break;
case 23:D[s-1]=-D[s-1]|0;break;
case 27:D[s-1]=~D[s-1];break;
case 48:case 49:case 50:if(y==48||!D[--s]===(y==49))q=t+((p[t-2]|p[t-1]<<8)<<16>>16);break;
case 51:if(c==64)return e(7);C[c++]=t;q=p[t-2]|p[t-1]<<8;break;
case 52:if(!c)return e(8);q=C[--c];break;
case 64:case 65:{const a=D[--s];if(a>>>8)return e(6);y==64?D[s++]=M[a]:(M[a]=D[--s]);break}
case 80:{const z=''+D[--s];if(o+z.length>65536)return e(11);for(let l=0;l<z.length;)O[o++]=z.charCodeAt(l++);break}
case 81:if(o==65536)return e(11);O[o++]=D[--s]&255;break;
case 82:D[s++]=i<I.length?I[i++]:-1;break;
case 83:return e(D[--s]&255);
default:{const b=D[--s],a=D[--s],u=a>>>0,v=b>>>0;if(y>=19&&y<=22&&!b)return e(4);D[s++]=y==16?(a+b)|0:y==17?(a-b)|0:y==18?Math.imul(a,b):y==19?(a/b)|0:y==20?(a%b)|0:y==21?u/v|0:y==22?u%v|0:y==24?a&b:y==25?a|b:y==26?a^b:y==28?a<<b:y==29?a>>b:y==30?a>>>b:y==32?+(a==b):y==33?+(a<b):+(u<v)}
}}};
const E=process.env,A=E.MAKEFUN_INPUT_DIR??'/input',Z=E.MAKEFUN_OUTPUT_DIR??'/output',F=(f:string)=>{try{return r(f)}catch{return new Uint8Array(0)}};
for(const x of d(A).sort()){
const{o,c}=R(F(j(A,x,'program.bin')),F(j(A,x,'input.bin')));
m(j(Z,x),{recursive:true});
w(j(Z,x,'stdout.bin'),o);
w(j(Z,x,'exit.txt'),''+c)
}
