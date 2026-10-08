import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const CONFIG_IS_PLACEHOLDER = firebaseConfig.apiKey === "YOUR_API_KEY";

/* ======================= CONSTANTS / CURRICULUM ======================= */
const START = new Date(2026,9,1); // Oct 1 2026
const TOTAL_DAYS = 91; // Oct(31)+Nov(30)+Dec(30)
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtShort(d){return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}

// Typed 12h time field — stored internally as a 24h "HH:MM" string. A native
// <input type="time"> silently follows the browser/OS locale for 12h vs 24h
// display, which is why AM/PM can vanish; a plain text field the user types
// into (e.g. "9:06 AM") and that reformats itself on blur keeps AM/PM
// explicit on every device while staying as fast as just typing it.
function fmtTime(hhmm){
  if(!hhmm) return '--';
  const [h,m] = hhmm.split(':').map(Number);
  const ampm = h>=12 ? 'PM' : 'AM';
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
// Accepts "9:06 AM", "9.06am", "9 06 PM", "930am", "9am" — forgiving of
// punctuation/spacing since this is typed on a phone under a 12h constraint.
function parseTypedTime(str){
  if(!str) return null;
  const s = str.trim().toLowerCase().replace(/\s+/g,'');
  const m = s.match(/^(\d{1,2})[:.]?(\d{2})?(am|pm)$/);
  if(!m) return null;
  let h = parseInt(m[1],10);
  const min = m[2]!==undefined ? parseInt(m[2],10) : 0;
  const ap = m[3];
  if(h<1||h>12||min<0||min>59) return null;
  h = h%12; if(ap==='pm') h+=12;
  return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
}
function timePicker(id, value){
  return `<input type="text" id="${id}" inputmode="numeric" autocomplete="off" placeholder="e.g. 9:06 AM" value="${value? fmtTime(value):''}" data-valid="${value?'1':'0'}">`;
}
function readTimePicker(id){
  const el = document.getElementById(id);
  if(!el || el.value.trim()==='') return null;
  return parseTypedTime(el.value);
}
function wireTimeField(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener('blur', ()=>{
    if(el.value.trim()===''){ el.classList.remove('bad-input'); return; }
    const parsed = parseTypedTime(el.value);
    if(parsed){ el.value = fmtTime(parsed); el.classList.remove('bad-input'); }
    else { el.classList.add('bad-input'); }
  });
}
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
function dayIndexOf(date){return Math.floor((date-START)/864e5)+1;}
function dateOfIndex(i){return addDays(START,i-1);}
const TODAY_IDX = Math.min(Math.max(dayIndexOf(TODAY),1),TOTAL_DAYS);
function weekOfIndex(i){return Math.min(Math.ceil(i/7),13);}
const CURRENT_WEEK = weekOfIndex(TODAY_IDX);

const WEEKS = [
 {theme:"Python Foundations", production:"Expense Tracker CLI (Python)", mini1:"Terminal Tic-Tac-Toe AI", mini2:"Password Strength Checker"},
 {theme:"Python + Data", production:"Web Scraper & Report Generator", mini1:"Markdown → HTML Converter", mini2:"Weather CLI (Public API)"},
 {theme:"Python APIs", production:"REST API with FastAPI", mini1:"URL Shortener API", mini2:"JSON Resume Generator"},
 {theme:"JavaScript Core", production:"Vanilla JS Kanban Board", mini1:"Virtual Drum Kit", mini2:"Expense Splitter Calculator"},
 {theme:"Node.js Backend", production:"Node.js REST API + Auth", mini1:"Pomodoro Timer PWA", mini2:"Random Quote Generator (API)"},
 {theme:"Realtime JS", production:"Realtime Chat App (WebSockets)", mini1:"Typing Speed Test", mini2:"Markdown Notes App"},
 {theme:"Angular Foundations", production:"Angular Portfolio CMS", mini1:"Recipe Finder (Angular)", mini2:"GitHub Profile Viewer"},
 {theme:"Angular + State", production:"Angular E-Commerce Cart", mini1:"Movie Search App (TMDB)", mini2:"Currency Converter"},
 {theme:"Angular + Data Viz", production:"Angular Analytics Dashboard", mini1:"Habit Tracker Widget", mini2:"QR Code Generator"},
 {theme:"Full-Stack I", production:"Task Manager (Angular + Python API)", mini1:"AI Chatbot UI Wrapper", mini2:"Image Compressor Tool"},
 {theme:"Full-Stack II", production:"Personal Finance Dashboard (Angular+Node)", mini1:"Budget Planner w/ Charts", mini2:"Flashcard Memory App"},
 {theme:"Capstone & Polish", production:"Capstone Portfolio Site (Deployed)", mini1:"Portfolio Animation Microsite", mini2:"Resume Builder Tool"},
 {theme:"Review & Launch", production:"Portfolio + Resume Final Polish", mini1:"GitHub README Overhaul", mini2:"LinkedIn Profile Revamp"},
];

const SKILLS = {
 "Python":["Syntax & data types","Functions & modules","OOP (classes, inheritance)","File I/O & error handling","List/dict comprehensions","Virtual envs & pip","APIs (requests, FastAPI/Flask)","Testing (pytest)","Decorators & generators","Working with databases (SQLite/ORM)"],
 "JavaScript":["ES6+ syntax (let/const, arrow fns)","Array/object methods","Async/await & Promises","DOM manipulation","Fetch API & JSON","Closures & scope","Node.js & npm basics","Express.js basics","Event loop understanding","Testing (Jest)"],
 "HTML & CSS":["Semantic HTML5","Flexbox","CSS Grid","Responsive design / media queries","CSS variables & animations","Accessibility (ARIA, alt text)","Forms & validation","SASS/SCSS basics"],
 "Angular":["Components & templates","Data binding & directives","Services & Dependency Injection","Routing & navigation","RxJS & Observables","Reactive forms","State management","HTTP client & interceptors","Angular CLI & build/deploy"],
};

const RELAX = [
 {ico:"✍️",name:"Story Writing",desc:"15 minutes, any story, no pressure"},
 {ico:"🎨",name:"Sketching / Doodling",desc:"Draw anything in front of you"},
 {ico:"📖",name:"Reading",desc:"20 minutes of fiction or non-fiction"},
 {ico:"📓",name:"Journaling",desc:"Write 3 honest lines about today"},
 {ico:"🧩",name:"Puzzle / Sudoku",desc:"One puzzle, no scrolling after"},
 {ico:"🍲",name:"New Healthy Recipe",desc:"Try cooking one new simple dish"},
 {ico:"🧹",name:"Declutter Sprint",desc:"Tidy one drawer, desk, or corner — 10 min, timer on"},
 {ico:"🤸",name:"Stretch Flow",desc:"10 min of mobility / stretching, no gym needed"},
 {ico:"🎬",name:"Movie Night",desc:"Watch one movie, phone away, actually enjoy it"},
];
function relaxForIndex(i){return RELAX[(i-1)%RELAX.length];}

const CORE_RULES = [
 {key:"wake", label:"Wake by 7:30am"},
 {key:"sleep", label:"Asleep by 11:00pm"},
 {key:"steps", label:"8,000+ steps"},
 {key:"water", label:"3L water"},
 {key:"clean", label:"1200 cal, zero junk"},
 {key:"career", label:"Career task done"},
];
const MILESTONES = [30,60,90];
const MOOD_EMOJI = ["\u{1F62B}","\u{1F615}","\u{1F610}","\u{1F642}","\u{1F60A}"]; // 1..5

// A different affirmation each day of the 91 (cycles if you outlast the list) —
// shown as a celebratory overlay on a clean day. Deterministic by day index so
// it's not random spam, just genuinely different day to day.
const CLEAN_AFFIRMATIONS = [
  "Discipline beats motivation. You just proved it.",
  "That's one more brick in the arc.",
  "Your future self just said thank you.",
  "Cravings knocked. You didn't answer. \u{1F525}",
  "This is what becoming someone new looks like.",
  "Small win. Real win. Keep stacking them.",
  "You chose long-term you over right-now you.",
  "Nobody saw that choice but it still counted.",
  "The old you would've ordered. You didn't.",
  "Consistency is the whole game. You're playing it.",
  "That's a rep in the identity you're building.",
  "Quiet discipline. Loud results, eventually.",
  "You kept a promise to yourself today.",
  "This is the boring work that actually works.",
  "One more day your word meant something.",
  "You're not white-knuckling this anymore — you're doing it.",
  "That craving lost. You won.",
  "Future you is out here thriving because of today.",
  "This is the version of you that finishes the 91.",
  "Nobody's clapping, but I am. Great work.",
  "Proof > promises. You just delivered proof.",
  "You're harder to shake than you think.",
  "The arc only rises because of days exactly like this.",
  "You didn't negotiate with the craving. Respect.",
  "Clean day. Clear head. Keep going.",
  "That's self-respect in action.",
  "You're building a reputation with yourself. It's working.",
  "Still here. Still clean. Still climbing.",
  "This is what showing up actually looks like.",
  "You just made tomorrow's you a little stronger.",
];
function pickOfTheDay(list){ return list[(TODAY_IDX-1) % list.length]; }

// Blunt, number-driven consequence statement — no insults, no soft "it's just
// data" framing. Computed from the user's own logged slip rate so it's a real
// projection, not a canned line. Assumes ~600 kcal surplus on an unlogged
// slip day (noted in the message) and 7700 kcal ≈ 1kg of fat.
function computeJunkStats(){
  const days = Object.values(state.days);
  const logged = days.filter(d=>d.junkFree===true || d.junkFree===false);
  const slipDays = logged.filter(d=>d.junkFree===false);
  const ASSUMED_EXCESS = 600;
  const excessList = slipDays.map(d=> d.calories!=null ? Math.max(0, Number(d.calories)-1200) : ASSUMED_EXCESS);
  const avgExcess = excessList.length ? excessList.reduce((a,b)=>a+b,0)/excessList.length : ASSUMED_EXCESS;
  const slipRate = logged.length ? slipDays.length/logged.length : 0;
  const daysRemaining = TOTAL_DAYS - TODAY_IDX;
  const projectedExtraKg = (slipRate * daysRemaining * avgExcess) / 7700;
  return {slipCount: slipDays.length, totalLogged: logged.length, slipRate, avgExcess, daysRemaining, projectedExtraKg};
}
function buildSlipMessage(){
  const s = computeJunkStats();
  const pct = s.totalLogged ? Math.round(s.slipRate*100) : 0;
  if(s.totalLogged < 4){
    return `Slip #${s.slipCount} logged. Not enough data yet for a real projection — give it a week and the math will show you exactly where this goes.`;
  }
  if(s.projectedExtraKg < 0.3){
    return `${pct}% of your logged days are slips. Still a low rate — keep it there, because the moment it climbs, the projection below turns against you fast.`;
  }
  return `You're slipping on ${pct}% of logged days, averaging ~${Math.round(s.avgExcess)} extra kcal each. Hold that rate for the remaining ${s.daysRemaining} days and you gain roughly ${s.projectedExtraKg.toFixed(1)}kg — not lose it. That's arithmetic, not an opinion: ${Math.round(s.slipRate*s.daysRemaining)} more slips at this rate ends with you heavier than you started this arc.`;
}
function showJunkFeedback(isClean){
  const overlay = document.createElement('div');
  overlay.className = 'feedback-overlay ' + (isClean? 'celebrate' : 'fail');
  const line = isClean ? pickOfTheDay(CLEAN_AFFIRMATIONS) : buildSlipMessage();
  overlay.innerHTML = `
    <div class="feedback-card">
      <div class="feedback-emoji">${isClean? '✨' : '\u{1F4C9}'}</div>
      <div class="feedback-title">${isClean? 'CLEAN DAY!' : 'SLIPPED'}</div>
      <div class="feedback-line">${line}</div>
    </div>`;
  document.body.appendChild(overlay);
  if(isClean && window.confetti){
    confetti({particleCount:140, spread:90, origin:{y:0.5}, colors:['#e2601f','#c98a1f','#1f8a57','#ffb347']});
  }
  overlay.addEventListener('click', ()=>overlay.remove());
  setTimeout(()=>overlay.remove(), isClean?2800:5200);
}
const CAREER_TASKS = [
 {key:"dsa", label:"DSA"},
 {key:"linkedin", label:"LinkedIn clean-up"},
 {key:"github", label:"GitHub clean-up"},
 {key:"project", label:"Project work"},
 {key:"posts", label:"Post / content-related work"},
];

// A realistic 3-month AI Engineering path: 17 nodes, each with a concept
// explainer, a concrete build task, and real external resources — distilled
// from the roadmap.sh AI Engineer track with the filler (generic dev tooling,
// the full vendor-platform survey) cut and an evaluation/observability node
// added back in, since that's the actual gap in most "RAG tutorial" learning.
const AIE_NODES = [
 {id:'n1', month:1, icon:'\u{1F9ED}', title:'What is an AI Engineer?', xp:50,
   concept:"An AI Engineer builds products on top of existing models (LLMs, embeddings, vision models) rather than training models from scratch like an ML researcher. The job is integration, prompting, data pipelines, and reliability — not matrix calculus.",
   build:'No code today. Write a one-paragraph answer: "What would I build in my first 30 days as an AI engineer at a startup?" Save it — revisit it at the capstone.',
   resources:[{name:'roadmap.sh — AI Engineer', url:'https://roadmap.sh/ai-engineer'}]},
 {id:'n2', month:1, icon:'\u{1F524}', title:'LLM Fundamentals', xp:50,
   concept:'Tokens are the units models read/write (roughly 4 characters = 1 token in English). Context window = how many tokens a model can hold in one request. Inference = running a trained model to get output; training = adjusting its weights — as an AI engineer you almost always do the former, never the latter.',
   build:'Write a short script that counts tokens in a paragraph (tiktoken in Python, or gpt-tokenizer in JS) and prints an estimated cost at current GPT-4o-mini pricing.',
   resources:[{name:'OpenAI Tokenizer', url:'https://platform.openai.com/tokenizer'}]},
 {id:'n3', month:1, icon:'✍️', title:'Prompt Engineering', xp:60,
   concept:'System prompts set persistent behavior; user prompts carry the request. Few-shot examples teach format by showing 2–3 examples before the real question. Clear, structured prompts beat clever wording almost every time.',
   build:'Build a CLI tool that takes a topic and returns a structured JSON summary (title, 3 bullets, difficulty) — try it zero-shot, then few-shot, and compare the outputs.',
   resources:[{name:'Prompt Engineering Guide', url:'https://www.promptingguide.ai'}]},
 {id:'n4', month:1, icon:'\u{1F4AC}', title:'OpenAI API & Chat Completions', xp:70,
   concept:'The Chat Completions API takes a list of role-tagged messages (system/user/assistant) and returns a new assistant message. Almost every LLM product is a loop around this one call.',
   build:'Build a terminal chatbot (Python or Node) that keeps conversation history in an array and streams the response back token by token.',
   resources:[{name:'OpenAI API Reference', url:'https://platform.openai.com/docs/api-reference/chat'}]},
 {id:'n5', month:1, icon:'\u{1F6E0}️', title:'Function Calling & Structured Output', xp:70,
   concept:"Function calling lets the model choose to call a function you've defined (via a JSON schema) instead of just replying in text — this is the mechanism underneath every agent and tool. JSON mode forces a reply into a schema you define.",
   build:'Build a bot that answers "what’s 23 × 47?" or "weather in Chennai?" by calling a calculator function and a (mocked) weather function you define.',
   resources:[{name:'Function Calling Guide', url:'https://platform.openai.com/docs/guides/function-calling'}]},
 {id:'n6', month:1, icon:'\u{1F4B0}', title:'Token Economics & Cost Control', xp:50,
   concept:'Every call costs money per input + output token. Costs explode fast with long context, RAG, and agent loops. Caching, trimming history, and picking smaller models for simple tasks are the main levers.',
   build:"Add a running cost tracker to your Node 4 chatbot that prints total $ spent after each reply, using the model's published per-1k-token price.",
   resources:[{name:'OpenAI Pricing', url:'https://openai.com/api/pricing'}]},
 {id:'n7', month:2, icon:'\u{1F9EC}', title:'Embeddings', xp:60,
   concept:'An embedding turns text into a vector of numbers positioned so similar meanings sit close together in that space. Cosine similarity measures how close two vectors are — that’s the math behind "semantic search."',
   build:'Embed 10 sentences with the OpenAI embeddings API, compute cosine similarity between every pair, and print the most similar pair.',
   resources:[{name:'OpenAI Embeddings Guide', url:'https://platform.openai.com/docs/guides/embeddings'}]},
 {id:'n8', month:2, icon:'\u{1F5C4}️', title:'Vector Databases', xp:70,
   concept:'A vector database stores embeddings and answers "find me the K most similar vectors to this one" fast, even over millions of entries — the retrieval half of RAG.',
   build:'Install Chroma locally, load 20 short notes into it, and query it with a question to get back the 3 most relevant notes.',
   resources:[{name:'Chroma Docs', url:'https://docs.trychroma.com'}]},
 {id:'n9', month:2, icon:'\u{1F4DA}', title:'RAG Pipeline', xp:90,
   concept:'Retrieval-Augmented Generation: chunk your documents, embed the chunks, store them in a vector DB, retrieve the top-K relevant chunks for a question, then stuff them into the prompt so the model answers from YOUR data, not just its training data.',
   build:'Build a RAG chatbot over a folder of your own notes or a PDF: chunk it, embed with OpenAI, store in Chroma, retrieve + answer questions about the content.',
   resources:[{name:'RAG Tutorial (LangChain)', url:'https://python.langchain.com/docs/tutorials/rag/'}]},
 {id:'n10', month:2, icon:'\u{1F999}', title:'Open-Source Models (Hugging Face / Ollama)', xp:70,
   concept:'Open-source models (Llama, Mistral, Qwen) run on your own machine or server — no per-token cost, full data privacy, but you manage the infra. Ollama makes running them locally a one-line command.',
   build:'Install Ollama, pull a small model, and swap it into your Node 9 RAG chatbot in place of the OpenAI model.',
   resources:[{name:'Ollama', url:'https://ollama.com'},{name:'Hugging Face Hub', url:'https://huggingface.co/models'}]},
 {id:'n11', month:2, icon:'\u{1F4CA}', title:'Evaluation & Observability', xp:60,
   concept:"Production AI apps log every prompt/response pair and score them (accuracy, relevance, latency, cost) — without this you're flying blind on whether a prompt change made things better or worse. This is what separates a shipped product from a tutorial demo.",
   build:'Add logging to your RAG app: save every question, retrieved chunks, answer, latency, and cost to a local file or SQLite table, then write a script that reports averages.',
   resources:[{name:'LangSmith (tracing/eval)', url:'https://docs.smith.langchain.com'}]},
 {id:'n12', month:2, icon:'\u{1F6E1}️', title:'AI Safety & Prompt Injection', xp:50,
   concept:'Prompt injection = a user hides instructions in their input to hijack your system prompt ("ignore previous instructions..."). Defenses: never trust retrieved/user content as instructions, validate outputs, run inputs through a moderation check.',
   build:"Run user questions through OpenAI's free Moderation API before they reach your RAG app's main prompt, and refuse/flag anything it marks unsafe.",
   resources:[{name:'OpenAI Moderation API', url:'https://platform.openai.com/docs/guides/moderation'}]},
 {id:'n13', month:3, icon:'\u{1F916}', title:'AI Agents & ReAct', xp:80,
   concept:'An agent loops: think → decide which tool to call → observe the result → think again → ... until it has a final answer. ReAct (Reason+Act) is the classic pattern behind this loop.',
   build:'Build a small agent with no framework that can use 2 tools — a calculator and your Node 9 RAG search — and decides on its own which to call.',
   resources:[{name:'ReAct Prompting Explainer', url:'https://www.promptingguide.ai/techniques/react'}]},
 {id:'n14', month:3, icon:'\u{1F517}', title:'Agent Framework (LangChain or LlamaIndex)', xp:70,
   concept:'Frameworks like LangChain and LlamaIndex give you pre-built chains, agents, memory, and retrievers so you stop hand-rolling plumbing — worth adopting once you understand what they’re wrapping, which you now do.',
   build:'Rebuild your Node 13 agent using LangChain’s (or LlamaIndex’s) agent/tool abstractions — same behavior, far less boilerplate.',
   resources:[{name:'LangChain Agents', url:'https://python.langchain.com/docs/concepts/agents/'}]},
 {id:'n15', month:3, icon:'\u{1F5BC}️', title:'Multimodal AI', xp:60,
   concept:'Multimodal models accept more than text — images (Vision), audio (Whisper for speech-to-text, TTS for speech-out). Same API shape, different input/output type.',
   build:'Add one multimodal feature to an earlier project: let users upload an image and ask about it (Vision API), or speak a question that gets transcribed (Whisper) before it hits your RAG pipeline.',
   resources:[{name:'OpenAI Vision Guide', url:'https://platform.openai.com/docs/guides/vision'},{name:'Whisper API', url:'https://platform.openai.com/docs/guides/speech-to-text'}]},
 {id:'n16', month:3, icon:'\u{1F3C6}', title:'Capstone: Full AI App', xp:120,
   concept:'Combine everything: RAG + an agent with at least one tool + eval logging + basic injection defense + a simple UI. This is the single project that goes at the top of your portfolio.',
   build:'Ship one complete app end to end, and deploy it somewhere reachable by a link (Render, Railway, or a recorded demo if deploy time runs out).',
   resources:[]},
 {id:'n17', month:3, icon:'\u{1F4E3}', title:'Portfolio & Interview Prep', xp:50,
   concept:'Interviewers for AI engineering roles want to see you can explain tradeoffs (RAG vs fine-tuning, open vs closed models, cost vs latency) and discuss one real project in depth — not recite a tutorial.',
   build:'Write a README for your capstone explaining the architecture and why you made each tradeoff. Post it with a short demo to GitHub and LinkedIn.',
   resources:[]},
];
const AIE_LEVELS = [0,120,280,480,720,1000,1300];
const AIE_RANKS = ['Curious Newcomer','Prompt Apprentice','RAG Builder','Agent Engineer','Systems Thinker','AI Engineer'];

// A curated 90-problem DSA sheet covering every core interview pattern —
// essentially Blind 75 + the rest of NeetCode 150's highest-value problems.
// Names are editable per-row in the UI, so swap any slot for your own pick.
const DSA_PROBLEMS = (()=>{
  const groups = [
    ["Arrays & Hashing", ["Contains Duplicate","Valid Anagram","Two Sum","Group Anagrams","Top K Frequent Elements","Product of Array Except Self","Valid Sudoku","Longest Consecutive Sequence"]],
    ["Two Pointers", ["Valid Palindrome","Two Sum II - Input Array Is Sorted","3Sum","Container With Most Water","Trapping Rain Water"]],
    ["Sliding Window", ["Best Time to Buy and Sell Stock","Longest Substring Without Repeating Characters","Longest Repeating Character Replacement","Permutation in String","Minimum Window Substring","Sliding Window Maximum"]],
    ["Stack", ["Valid Parentheses","Min Stack","Evaluate Reverse Polish Notation","Generate Parentheses","Daily Temperatures","Car Fleet"]],
    ["Binary Search", ["Binary Search","Search a 2D Matrix","Koko Eating Bananas","Find Minimum in Rotated Sorted Array","Search in Rotated Sorted Array","Median of Two Sorted Arrays"]],
    ["Linked List", ["Reverse Linked List","Merge Two Sorted Lists","Reorder List","Remove Nth Node From End of List","Copy List with Random Pointer","Add Two Numbers","Linked List Cycle","Merge k Sorted Lists"]],
    ["Trees", ["Invert Binary Tree","Maximum Depth of Binary Tree","Diameter of Binary Tree","Balanced Binary Tree","Same Tree","Subtree of Another Tree","Lowest Common Ancestor of a BST","Binary Tree Level Order Traversal","Binary Tree Right Side View","Count Good Nodes in Binary Tree","Validate Binary Search Tree","Kth Smallest Element in a BST"]],
    ["Tries", ["Implement Trie (Prefix Tree)","Design Add and Search Words Data Structure","Word Search II"]],
    ["Heap / Priority Queue", ["Kth Largest Element in a Stream","Last Stone Weight","K Closest Points to Origin","Task Scheduler","Find Median from Data Stream"]],
    ["Backtracking", ["Subsets","Combination Sum","Permutations","Subsets II","Word Search","Palindrome Partitioning"]],
    ["Graphs", ["Number of Islands","Clone Graph","Max Area of Island","Pacific Atlantic Water Flow","Surrounded Regions","Rotting Oranges","Walls and Gates","Course Schedule","Redundant Connection"]],
    ["1D Dynamic Programming", ["Climbing Stairs","House Robber","House Robber II","Longest Palindromic Substring","Palindromic Substrings","Decode Ways","Coin Change","Word Break"]],
    ["2D Dynamic Programming", ["Unique Paths","Longest Common Subsequence","Best Time to Buy and Sell Stock with Cooldown","Edit Distance"]],
    ["Greedy", ["Maximum Subarray","Jump Game","Gas Station"]],
    ["Intervals", ["Merge Intervals"]],
  ];
  let n=0;
  const out=[];
  groups.forEach(([cat, names])=>names.forEach(name=>{ n++; out.push({id:'p'+n, cat, name}); }));
  return out;
})();

/* ======================= STATE ======================= */
let app, auth, db, uid=null, currentUser=null;
let state = {days:{}, career:{}, skills:{}, profile:{}, weekly:{}, milestones:{}, dsa:{}, aie:{}};
let aieSelected = null;
let activeTab = 'dashboard';
let todayDate = iso(TODAY);
let unsubs = [];

function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ======================= FIRESTORE HELPERS ======================= */
async function writeDoc(path, data){
  state[path.col][path.id] = {...(state[path.col][path.id]||{}), ...data};
  renderActiveOnly();
  try{
    await setDoc(doc(db,'users',uid,path.col,path.id), data, {merge:true});
  }catch(e){
    console.error('write failed', e);
    toast('Could not save — check your connection');
  }
}

// Same as writeDoc but never re-renders — for the Today tab's instant-save
// controls (toggles, craving log), which update their own bit of DOM directly
// so a half-filled form isn't rebuilt (and its unsaved fields lost) on every click.
async function writeDocQuiet(path, data){
  state[path.col][path.id] = {...(state[path.col][path.id]||{}), ...data};
  try{
    await setDoc(doc(db,'users',uid,path.col,path.id), data, {merge:true});
  }catch(e){
    console.error('write failed', e);
    toast('Could not save — check your connection');
  }
}

async function clearDoc(path){
  const existed = !!state[path.col][path.id];
  delete state[path.col][path.id];
  renderActiveOnly();
  if(!db || !uid){ toast('Not signed in — nothing to clear'); return; }
  try{
    await deleteDoc(doc(db,'users',uid,path.col,path.id));
    toast(existed ? 'Cleared' : 'Already empty');
  }catch(e){
    console.error('delete failed', e);
    toast('Could not clear: '+(e.code||e.message||'unknown error'));
  }
}

// The Today tab edits a half-filled form live; a background sync landing
// mid-edit must never rebuild it out from under the user (that was the bug
// behind "most fields aren't saving" — any write, even one's own, re-rendered
// the whole page via these listeners before the Save button was pressed).
// Today manages its own DOM directly, so background snapshots skip it.
function renderFromSync(){
  if(activeTab==='today' || activeTab==='weekly') return;
  renderAll();
}

function subscribeAll(){
  unsubs.forEach(u=>u());
  unsubs = [];
  ['days','career','weekly','milestones'].forEach(col=>{
    const un = onSnapshot(collection(db,'users',uid,col), snap=>{
      const obj={}; snap.forEach(d=>obj[d.id]=d.data());
      state[col]=obj; renderFromSync();
    }, err=>console.error(col,err));
    unsubs.push(un);
  });
  unsubs.push(onSnapshot(doc(db,'users',uid,'skills','checklist'), snap=>{
    state.skills = snap.exists() ? snap.data() : {}; renderFromSync();
  }, err=>console.error(err)));
  unsubs.push(onSnapshot(doc(db,'users',uid,'dsa','checklist'), snap=>{
    state.dsa = snap.exists() ? snap.data() : {}; renderFromSync();
  }, err=>console.error(err)));
  unsubs.push(onSnapshot(doc(db,'users',uid,'aie','progress'), snap=>{
    state.aie = snap.exists() ? snap.data() : {}; renderFromSync();
  }, err=>console.error(err)));
  unsubs.push(onSnapshot(doc(db,'users',uid,'profile','main'), snap=>{
    state.profile = snap.exists() ? snap.data() : {}; renderFromSync();
  }, err=>console.error(err)));
}

function renderActiveOnly(){
  if(activeTab==='dashboard') renderDashboard();
  if(activeTab==='today') renderToday();
  if(activeTab==='history') renderHistory();
  if(activeTab==='career') renderCareer();
  if(activeTab==='dsa') renderDSA();
  if(activeTab==='aie') renderAIE();
  if(activeTab==='finance') renderFinance();
}

/* ======================= SCORING ======================= */
// Minutes after NOON, wrapping forward through midnight — so 23:00 -> 660,
// 00:00 -> 720, 01:00 -> 780. This makes "later" always a BIGGER number even
// across midnight, which a plain string/time compare gets backwards (a plain
// compare scores 1:00am as "earlier" than 11:00pm, which is wrong).
function minutesAfterNoon(hhmm){
  const [h,m] = hhmm.split(':').map(Number);
  let rel = (h*60+m) - 12*60;
  if(rel < 0) rel += 1440;
  return rel;
}
function fmtMinutes(mins){
  const h = Math.floor(mins/60), m = mins%60;
  return (h>0? h+'h ':'') + (m>0||h===0? m+'m':'');
}
const SLEEP_TARGET = minutesAfterNoon("23:00"); // 660
const WAKE_TARGET = 7*60+30; // minutes after midnight

// Steps ramp from a realistic 4,000/day start up to the full 10,000 target
// over 6 weeks, instead of demanding 8-10k from day one.
const STEP_RAMP_START = 4000, STEP_RAMP_END = 10000, STEP_RAMP_DAYS = 42;
function stepTarget(dayIndex){
  if(dayIndex>=STEP_RAMP_DAYS) return STEP_RAMP_END;
  if(dayIndex<=1) return STEP_RAMP_START;
  return Math.round(STEP_RAMP_START + (STEP_RAMP_END-STEP_RAMP_START)*(dayIndex-1)/(STEP_RAMP_DAYS-1));
}

// Every day with no entry at all before today counts as "missed." Debt is
// missed days minus days already repaid by hitting the boosted catch-up bar.
function missedDaysCount(){
  let n=0;
  for(let i=1;i<TODAY_IDX;i++){ if(!state.days[iso(dateOfIndex(i))]) n++; }
  return n;
}
function catchUpDebt(){
  return Math.max(0, missedDaysCount() - (state.profile.catchUpRepaid||0));
}
function catchUpBoost(){
  return 1 + Math.min(catchUpDebt(),5)*0.2; // +20% per missed day, capped at +100%
}

function scoreForDay(d, dateStr){
  if(!d) return null;
  const dayIdx = dateStr ? dayIndexOf(new Date(dateStr+'T00:00:00')) : TODAY_IDX;
  const isToday = dayIdx === TODAY_IDX;
  const target = stepTarget(dayIdx);
  const boostedTarget = isToday ? Math.round(target*catchUpBoost()) : target;
  const careerNeeded = (isToday && catchUpDebt()>0) ? 2 : 1;
  let score=0;
  const flags=[];
  const careerDoneCount = d.careerTasks ? Object.values(d.careerTasks).filter(Boolean).length : 0;
  const core = {
    wake: !!(d.wake && (d.wake.split(':').map(Number).reduce((h,m,i)=>i===0?h*60+m:h+m,0)) <= WAKE_TARGET),
    sleep: !!(d.sleep && minutesAfterNoon(d.sleep) <= SLEEP_TARGET),
    steps: Number(d.steps||0) >= boostedTarget,
    water: Number(d.water||0) >= 3,
    clean: d.junkFree === true && Number(d.calories||9999) <= 1200,
    career: careerDoneCount >= careerNeeded,
  };
  CORE_RULES.forEach(r=>{ if(core[r.key]) score+=10; });

  if(d.wake && !core.wake){
    const wakeMins = d.wake.split(':').map(Number).reduce((h,m,i)=>i===0?h*60+m:h+m,0);
    flags.push(`Woke up ${fmtMinutes(wakeMins-WAKE_TARGET)} past 7:30am`);
  }
  if(d.sleep && !core.sleep){
    flags.push(`Slept ${fmtMinutes(minutesAfterNoon(d.sleep)-SLEEP_TARGET)} past the 11:00pm curfew`);
  }
  if(!core.steps && d.steps!=null){
    flags.push(`${(boostedTarget-Number(d.steps)).toLocaleString()} steps short of ${boostedTarget.toLocaleString()}${boostedTarget>target?' (boosted for catch-up)':''}`);
  }
  if(!core.water && d.water!=null){
    flags.push(`${(3-Number(d.water)).toFixed(1)}L short of your 3L water goal`);
  }
  if(d.junkFree===false){
    flags.push(`Ate junk / sodium-heavy food`);
  }
  if(Number(d.calories||0) > 1200){
    flags.push(`${(Number(d.calories)-1200).toLocaleString()} cal over your 1200 budget`);
  }
  if(!core.career && d.careerTasks){
    flags.push(careerNeeded>1 ? `Only ${careerDoneCount}/${careerNeeded} career tasks — catch-up mode needs 2` : `No career task done`);
  }
  if(d.ordered){
    flags.push(`Ordered Zepto/Zomato — ₹${Number(d.amountSpent||0).toLocaleString()} spent`);
  }

  let bonus=0;
  if(Number(d.screenTime||99) <= 3) bonus+=10;
  if(d.relaxDone) bonus+=10;
  if(d.mood) bonus+=10;
  if(!d.cravings || d.cravings.every(c=>c.resisted)) bonus+=10;
  else flags.push(`Craving slipped: ${d.cravings.filter(c=>!c.resisted).map(c=>c.trigger).join(', ')}`);
  score+=bonus;
  return {score, core, bonus, flags, target, boostedTarget, careerNeeded};
}

function computeStreak(){
  let streak=0;
  for(let i=TODAY_IDX;i>=1;i--){
    const ds = iso(dateOfIndex(i));
    const d = state.days[ds];
    const s = scoreForDay(d, ds);
    if(s && s.score>=70) streak++; else break;
  }
  return streak;
}

function computeNoOrderStreak(){
  let streak=0;
  for(let i=TODAY_IDX;i>=1;i--){
    const ds = iso(dateOfIndex(i));
    const d = state.days[ds];
    if(!d) break;
    if(d.ordered) break;
    streak++;
  }
  return streak;
}

// Blunt pace-to-goal projections — "if you keep doing exactly what you're
// doing, here's precisely where you land on Day 90, and what that costs you."
// No encouragement baked in; only returns items that are currently off-pace,
// each with a stated real-world consequence of finishing at that rate.
function computeRealityCheck(){
  const daysElapsed = Math.max(1, TODAY_IDX);
  const daysRemaining = TOTAL_DAYS - TODAY_IDX;
  const careerVals = Object.values(state.career||{});
  const postsTotal = careerVals.reduce((s,c)=>s+Number(c.posts||0),0);
  const prodDone = careerVals.filter(c=>c.production).length;
  const miniDone = careerVals.reduce((s,c)=>s+(c.mini1?1:0)+(c.mini2?1:0),0);
  const dsaSolved = DSA_PROBLEMS.filter(p=>state.dsa[p.id] && state.dsa[p.id].done).length;
  const items = [];

  const pace = (done,target,label,consequence)=>{
    const projected = Math.round((done/daysElapsed)*TOTAL_DAYS);
    if(projected < target) items.push({label, done, target, projected, consequence: consequence(projected, target-projected)});
  };

  pace(dsaSolved, 90, 'DSA sheet', (proj,short)=>
    `At your current solve rate you finish with ~${proj}/90 problems by Dec 30 — ${short} short. That's not enough pattern coverage to recognize problems on sight in an interview; you'll be deriving from scratch under time pressure instead of recalling.`);
  pace(postsTotal, 48, 'LinkedIn posts', (proj,short)=>
    `Current posting rate projects to ~${proj}/48 posts by Dec 30, ${short} short of target. A profile with that few posts over 3 months reads as dormant to a recruiter scanning it, not someone building in public.`);
  pace(prodDone, 12, 'Production projects', (proj,short)=>
    `You're on pace for ~${proj}/12 production-grade projects, ${short} short. A portfolio showing ${proj} finished projects is a weak signal sitting next to other candidates showing 10+.`);
  pace(miniDone, 24, 'Mini projects', (proj,short)=>
    `Projected ~${proj}/24 mini projects, ${short} short — less proof to employers that you ship fast and often, not just big slow projects.`);

  // Daily-consistency rates: only counts days a field was actually logged,
  // and only flags a rule whose miss-rate is high enough to matter.
  const entries = Object.entries(state.days);
  const rateCheck = (label, metFn, loggedFn, consequence)=>{
    const logged = entries.filter(([ds,d])=>loggedFn(d,ds));
    if(logged.length < 5) return; // not enough data to mean anything yet
    const met = logged.filter(([ds,d])=>metFn(d,ds)).length;
    const rate = met/logged.length;
    if(rate < 0.6) items.push({label, done:met, target:logged.length, projected:Math.round(rate*100), consequence: consequence(Math.round(rate*100))});
  };
  rateCheck('Step goal', (d,ds)=>Number(d.steps||0)>=stepTarget(dayIndexOf(new Date(ds+'T00:00:00'))), d=>d.steps!=null, pct=>
    `You've hit your (ramping) step target on only ${pct}% of logged days. At that consistency, expect your fat-loss timeline to roughly double against what the 1200-cal plan assumes — diet alone isn't carrying this.`);
  rateCheck('Water goal', d=>Number(d.water||0)>=3, d=>d.water!=null, pct=>
    `3L water hit on only ${pct}% of logged days. Chronic under-hydration reads as hunger to your brain — part of why cravings keep winning.`);
  rateCheck('Sleep curfew', d=>d.sleep && minutesAfterNoon(d.sleep)<=SLEEP_TARGET, d=>!!d.sleep, pct=>
    `Only ${pct}% of logged nights hit your 11pm curfew. Poor sleep directly raises next-day cravings and cuts focus — it's quietly sabotaging both the weight and career tracks at once, not just one.`);

  return items;
}

/* ======================= SHELL ======================= */
const TABS = [
 {id:'dashboard', label:'Dashboard'},
 {id:'today', label:'Today'},
 {id:'history', label:'History'},
 {id:'career', label:'Career'},
 {id:'dsa', label:'DSA'},
 {id:'aie', label:'AI Roadmap'},
 {id:'skills', label:'Skills'},
 {id:'relax', label:'Relax'},
 {id:'finance', label:'Finance'},
 {id:'weekly', label:'Weekly Review'},
 {id:'milestones', label:'Milestones'},
];

function renderTabs(){
  const el=document.getElementById('tabs');
  el.innerHTML = TABS.map(t=>`<button class="tab" role="tab" aria-selected="${t.id===activeTab}" data-tab="${t.id}">${t.label}</button>`).join('');
  el.querySelectorAll('.tab').forEach(b=>b.addEventListener('click', ()=>{ activeTab=b.dataset.tab; renderAll(); window.scrollTo({top:0,behavior:'smooth'}); }));
}

function renderAccount(){
  const box = document.getElementById('accountBox');
  if(!currentUser){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML = `<img src="${currentUser.photoURL||''}" alt=""><button id="signOutBtn">Sign out</button>`;
  box.querySelector('#signOutBtn').addEventListener('click', ()=>signOut(auth));
}

function renderAll(){
  if(!currentUser){ renderGate(); return; }
  document.getElementById('gate').innerHTML = '';
  document.getElementById('tabs').hidden = false;
  document.getElementById('footerNote').hidden = false;
  renderAccount();
  renderTabs();
  const host = document.getElementById('views');
  host.innerHTML = `
    <section class="view" id="view-dashboard" ${activeTab!=='dashboard'?'hidden':''}></section>
    <section class="view" id="view-today" ${activeTab!=='today'?'hidden':''}></section>
    <section class="view" id="view-history" ${activeTab!=='history'?'hidden':''}></section>
    <section class="view" id="view-career" ${activeTab!=='career'?'hidden':''}></section>
    <section class="view" id="view-dsa" ${activeTab!=='dsa'?'hidden':''}></section>
    <section class="view" id="view-aie" ${activeTab!=='aie'?'hidden':''}></section>
    <section class="view" id="view-skills" ${activeTab!=='skills'?'hidden':''}></section>
    <section class="view" id="view-relax" ${activeTab!=='relax'?'hidden':''}></section>
    <section class="view" id="view-finance" ${activeTab!=='finance'?'hidden':''}></section>
    <section class="view" id="view-milestones" ${activeTab!=='milestones'?'hidden':''}></section>
    <section class="view" id="view-weekly" ${activeTab!=='weekly'?'hidden':''}></section>
  `;
  document.getElementById('offlineBanner').innerHTML = '';

  if(activeTab==='dashboard') renderDashboard();
  if(activeTab==='today') renderToday();
  if(activeTab==='history') renderHistory();
  if(activeTab==='career') renderCareer();
  if(activeTab==='dsa') renderDSA();
  if(activeTab==='aie') renderAIE();
  if(activeTab==='skills') renderSkills();
  if(activeTab==='relax') renderRelax();
  if(activeTab==='finance') renderFinance();
  if(activeTab==='milestones') renderMilestones();
  if(activeTab==='weekly') renderWeekly();
}

function renderGate(){
  document.getElementById('tabs').hidden = true;
  document.getElementById('footerNote').hidden = true;
  document.getElementById('views').innerHTML = '';
  document.getElementById('offlineBanner').innerHTML = '';
  renderAccount();
  const warn = CONFIG_IS_PLACEHOLDER ? `<div class="config-warn">firebase-config.js still has placeholder values. Create a Firebase project, enable Google sign-in + Firestore, and paste your config into firebase-config.js before this will work.</div>` : '';
  document.getElementById('gate').innerHTML = `
    <div class="gate">
      <div class="gate-card">
        <svg width="40" height="40" viewBox="0 0 24 24"><path d="M12 2c2 3-1 4-1 7a3 3 0 1 0 6 0c0-1-.4-1.8-1-2.5 2.3 1.3 4 4 4 7.2C20 18.6 16.4 22 12 22S4 18.6 4 13.7c0-3 1.4-5.4 3.4-7C6.8 8 6.5 9.4 7 11c.6-3 2-5.3 5-9Z" fill="var(--accent)"/></svg>
        <h1>Redemption Arc</h1>
        <p>91 days. Oct 1 &ndash; Dec 30, 2026. Sign in with Google to load your tracker &mdash; your data lives in your own Firebase project under your account, the same on every device.</p>
        <button class="google-btn" id="googleSignIn">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.5 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
          Sign in with Google
        </button>
        ${warn}
      </div>
    </div>`;
  document.getElementById('googleSignIn').addEventListener('click', ()=>{
    signInWithPopup(auth, new GoogleAuthProvider()).catch(e=>{ console.error(e); toast('Sign-in failed: '+e.code); });
  });
}

/* ======================= DASHBOARD ======================= */
function animateNumber(el, to){
  const dur=900; const t0=performance.now();
  function step(t){
    const p=Math.min(1,(t-t0)/dur); const eased=1-Math.pow(1-p,3);
    el.textContent = Math.round(to*eased).toLocaleString();
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function allDaysSorted(){
  return Object.keys(state.days).sort().map(k=>({date:k, ...state.days[k]}));
}

function renderDashboard(){
  const host=document.getElementById('view-dashboard'); if(!host) return;
  const pct = Math.round((TODAY_IDX/TOTAL_DAYS)*100);
  const R=90, C=2*Math.PI*R, off = C - (TODAY_IDX/TOTAL_DAYS)*C;
  const streak = computeStreak();
  const days = allDaysSorted();
  const weights = days.filter(d=>d.weight).map(d=>Number(d.weight));
  const startW = weights[0], curW = weights[weights.length-1];
  const wDelta = (startW!=null && curW!=null) ? (curW-startW) : null;
  const totalSpent = days.reduce((s,d)=>s+(d.ordered? Number(d.amountSpent||0):0)+Number(d.otherSpend||0),0);
  const orderCount = days.filter(d=>d.ordered).length;
  const noOrderStreak = computeNoOrderStreak();
  const careerVals = Object.values(state.career||{});
  const postsTotal = careerVals.reduce((s,c)=>s+Number(c.posts||0),0);
  const prodDone = careerVals.filter(c=>c.production).length;
  const miniDone = careerVals.reduce((s,c)=>s+(c.mini1?1:0)+(c.mini2?1:0),0);

  const today = state.days[todayDate];
  const sc = scoreForDay(today, todayDate);
  const tileFor = (label,ok,sub)=>{
    const cls = today ? (ok? 'ok':'bad') : 'warn';
    return `<div class="tile ${cls}"><div class="label">${label}</div><div class="value">${today? (ok?'On track':'Slipped') : 'Not logged'}</div><div class="sub">${sub||''}</div></div>`;
  };

  const debt = catchUpDebt();
  host.innerHTML = `
    ${debt>0 ? `
    <div class="debt-alert">
      <div class="debt-alert-icon">⚠️</div>
      <div class="debt-alert-title">${debt} DAY${debt>1?'S':''} BEHIND</div>
      <div class="debt-alert-body">Today's catch-up bar: <strong>${Math.round(stepTarget(TODAY_IDX)*catchUpBoost()).toLocaleString()} steps</strong> (+${Math.round((catchUpBoost()-1)*100)}%) and <strong>2 career tasks</strong> instead of 1. Clear it to pay down 1 day of debt — no guilt-logging the missed days, just move forward.</div>
    </div>` : ''}
    <div class="hero">
      <div class="arc-wrap">
        <svg viewBox="0 0 220 220">
          <defs><linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent2)"/>
          </linearGradient></defs>
          <circle class="arc-track" cx="110" cy="110" r="${R}"/>
          <circle class="arc-fill" cx="110" cy="110" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 110 110)"/>
        </svg>
        <div class="arc-center"><div class="arc-day">${TODAY_IDX}</div><div class="arc-of">of ${TOTAL_DAYS} days &middot; ${pct}%</div></div>
      </div>
      <div class="hero-right">
        <h1>${debt>0 ? 'The arc has stalled.' : 'The arc is rising.'}</h1>
        <p>Week ${CURRENT_WEEK} of 13 &middot; ${fmtShort(TODAY)} &middot; ${TOTAL_DAYS-TODAY_IDX} days left until Dec 30</p>
        <span class="streak-chip">\u{1F525} <span class="flame"></span> ${streak}-day streak (score 70+)</span>
        <span class="countdown-chip">Weight ${wDelta!=null ? (wDelta<=0?('↓ '+Math.abs(wDelta).toFixed(1)+'kg'):('↑ '+wDelta.toFixed(1)+'kg')) : 'log weight to start'}</span>
        <span class="countdown-chip">₹${totalSpent.toLocaleString()} spent total (${orderCount} order${orderCount===1?'':'s'})</span>
        <span class="countdown-chip">\u{1F6AB} ${noOrderStreak}-day no-order streak</span>
        <div style="margin-top:10px;"><button class="btn secondary" id="exportBtn">⬇ Export full data to Excel</button></div>
      </div>
    </div>

    <div class="section-title">Today's non-negotiables</div>
    <div class="grid grid-4">
      ${tileFor('Wake / Sleep', today && sc && sc.core.wake && sc.core.sleep, today? fmtTime(today.wake)+' → '+fmtTime(today.sleep):'')}
      ${tileFor('Steps', today && sc && sc.core.steps, today?(Number(today.steps||0).toLocaleString()+' / '+sc.boostedTarget.toLocaleString()):'')}
      ${tileFor('Water & Calories', today && sc && sc.core.water && sc.core.clean, today?((today.water||0)+'L · '+(today.calories||'?')+'cal'):'')}
      ${tileFor('Career Task', today && sc && sc.core.career, today && sc? 'Score '+sc.score+'/100':'')}
    </div>

    ${sc && sc.flags.length ? `
    <div class="section-title">Red flags today</div>
    <div class="card" style="border-color:var(--bad);">
      ${sc.flags.map(f=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-size:13.5px;color:var(--bad);"><span>&#9888;</span><span>${f}</span></div>`).join('')}
    </div>` : (today ? `
    <div class="section-title">Red flags today</div>
    <div class="card" style="border-color:var(--good);color:var(--good);font-size:13.5px;">&#10003; Clean day — no red flags logged.</div>` : '')}

    ${(()=>{ const reality = computeRealityCheck(); return reality.length ? `
    <div class="section-title">\u{1F4C9} Reality check — where this pace actually ends</div>
    <div class="card" style="border-color:var(--bad);">
      ${reality.map(r=>`<div style="padding:8px 0;border-top:1px solid var(--line);font-size:13.5px;"><strong style="color:var(--bad);">${r.label}:</strong> <span class="muted">${r.consequence}</span></div>`).join('')}
    </div>` : `
    <div class="section-title">\u{1F4C9} Reality check — where this pace actually ends</div>
    <div class="card" style="border-color:var(--good);color:var(--good);font-size:13.5px;">Every tracked pace is currently on target for Day 90. That's the only thing keeping this projection clean — it recalculates from your real numbers every time you log.</div>`; })()}

    <div class="section-title">Career output (Oct &ndash; Dec)</div>
    <div class="card">
      <div class="bar-row"><span>LinkedIn posts</span><span class="num">${postsTotal} / 48</span></div>
      <div class="bar"><div style="width:${Math.min(100,postsTotal/48*100)}%"></div></div>
      <div class="bar-row" style="margin-top:12px;"><span>Production-grade projects</span><span class="num">${prodDone} / 12</span></div>
      <div class="bar"><div style="width:${Math.min(100,prodDone/12*100)}%"></div></div>
      <div class="bar-row" style="margin-top:12px;"><span>Mini / fun projects</span><span class="num">${miniDone} / 24</span></div>
      <div class="bar"><div style="width:${Math.min(100,miniDone/24*100)}%"></div></div>
    </div>

    <div class="section-title">Weight trend</div>
    <div class="card">${weightSparkline(days)}</div>
  `;

  requestAnimationFrame(()=>{ host.querySelector('.arc-fill').style.strokeDashoffset = off; });
  host.querySelector('#exportBtn').addEventListener('click', exportExcel);
}

function weightSparkline(days){
  const pts = days.filter(d=>d.weight);
  if(pts.length<2) return `<div class="faint" style="font-size:13px;">Log your weight on the Today tab (weekly is plenty) to see your trend line here.</div>`;
  const vals = pts.map(p=>Number(p.weight));
  const min=Math.min(...vals), max=Math.max(...vals);
  const W=600,H=60,pad=6;
  const x = i => pad + i*(W-2*pad)/(pts.length-1);
  const y = v => H-pad - (max===min?H/2:(v-min)/(max-min))*(H-2*pad);
  const path = vals.map((v,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(vals.length-1)}" cy="${y(vals[vals.length-1])}" r="4" fill="var(--accent2)"/>
  </svg>
  <div class="bar-row" style="margin-top:4px;"><span>Start ${vals[0]}kg</span><span>Now ${vals[vals.length-1]}kg</span></div>`;
}

/* ======================= TODAY ======================= */
function renderToday(){
  const host=document.getElementById('view-today'); if(!host) return;
  const d = state.days[todayDate] || {};
  const sc = scoreForDay(d, todayDate);
  const idx = dayIndexOf(new Date(todayDate+'T00:00:00'));
  const suggested = idx>=1 && idx<=TOTAL_DAYS ? relaxForIndex(idx) : RELAX[0];
  const relax = RELAX.find(r=>r.name===d.relaxChoice) || suggested;
  const R=36, C=2*Math.PI*R;
  const scorePct = sc? sc.score/100 : 0;

  host.innerHTML = `
    <div class="date-strip">
      <label class="field" style="flex:none;"><span>Date</span><input type="date" id="dateInput" value="${todayDate}" min="${iso(addDays(START,-1))}" max="${iso(addDays(START,TOTAL_DAYS-1))}"></label>
      ${iso(new Date(todayDate+'T00:00:00')) === iso(addDays(START,-1)) ? `<span class="faint" style="font-size:11.5px;">Sep 30 — your baseline day, logged before Day 1 officially starts</span>` : ''}
      <div style="flex:1"></div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="score-ring">
          <svg viewBox="0 0 92 92"><circle class="bgc" cx="46" cy="46" r="${R}"/><circle class="fgc" cx="46" cy="46" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C-(scorePct*C)}" transform="rotate(-90 46 46)"/></svg>
          <div class="label">${sc?sc.score:'--'}</div>
        </div>
        <div class="muted" style="font-size:12.5px;max-width:140px;">out of 100 &middot; 6 core rules + 4 bonus habits</div>
      </div>
    </div>

    ${sc && sc.flags.length ? `<div class="card" style="border-color:var(--bad);margin-bottom:14px;">
      ${sc.flags.map(f=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:13px;color:var(--bad);"><span>&#9888;</span><span>${f}</span></div>`).join('')}
    </div>` : ''}

    <details class="today-section" open>
      <summary class="section-title" style="margin-top:0;">\u{1F3C3} Physical</summary>
      <div class="card">
        <div class="fields-grid">
          <label class="field"><span>Wake time</span>${timePicker('f-wake', d.wake)}<span class="faint" style="font-size:10.5px;">goal: by 7:30 AM</span></label>
          <label class="field"><span>Sleep time</span>${timePicker('f-sleep', d.sleep)}<span class="faint" style="font-size:10.5px;">1:00 AM counts as 2h past the 11:00 PM curfew, not early</span></label>
          <label class="field"><span>Steps</span><input type="number" id="f-steps" min="0" step="100" value="${d.steps??''}" placeholder="${sc.boostedTarget}"><span class="faint" style="font-size:10.5px;">today's target: ${sc.boostedTarget.toLocaleString()}${sc.boostedTarget>sc.target?' (boosted, catching up)':''} — ramping to 10,000 by week 6</span></label>
          <label class="field"><span>Water (L)</span><input type="number" id="f-water" min="0" max="5" step="0.1" value="${d.water??''}" placeholder="3"></label>
          <label class="field"><span>Weight (kg)</span><input type="number" id="f-weight" min="0" step="0.1" value="${d.weight??''}" placeholder="weekly is fine"></label>
        </div>
      </div>
    </details>

    <details class="today-section">
      <summary class="section-title">\u{1F9E0} Mental</summary>
      <div class="card">
        <div class="fields-grid">
          <label class="field"><span>Screen time (hrs)</span><input type="number" id="f-screen" min="0" step="0.5" value="${d.screenTime??''}"></label>
          <label class="field"><span>Mood (1-5)</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="range" id="f-mood" min="1" max="5" step="1" value="${d.mood||3}" style="flex:1;">
              <span id="moodVal" class="mono" style="font-size:18px;min-width:28px;text-align:center;">${MOOD_EMOJI[(d.mood||3)-1]}</span>
            </div>
          </label>
        </div>
        <label class="field" style="margin-top:12px;"><span>Relax activity — pick one${d.relaxChoice?'':' (suggested: '+suggested.name+')'}</span>
          <select id="relaxPicker">${RELAX.map(r=>`<option value="${r.name}" ${r.name===relax.name?'selected':''}>${r.ico} ${r.name}</option>`).join('')}</select>
        </label>
        <div class="relax-card today" id="relaxCardToday" style="text-align:left;flex-direction:row;align-items:center;gap:12px;margin-top:10px;">
          <div class="relax-ico" id="relaxCardIco">${relax.ico}</div>
          <div style="flex:1;"><div class="relax-name" id="relaxCardDesc">${relax.desc}</div></div>
          <button class="toggle ${d.relaxDone?'active-yes':''}" data-field="relaxDone" data-val="true" style="flex:none;width:auto;padding:8px 14px;">${d.relaxDone?'Done ✓':'Mark done'}</button>
        </div>
      </div>
    </details>

    <details class="today-section">
      <summary class="section-title">\u{1F4BC} Career</summary>
      <div class="card">
        <label class="field"><span>What did you actually do today?</span>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            ${CAREER_TASKS.map(t=>`<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:400;color:var(--text);"><input type="checkbox" class="chk career-task-chk" data-key="${t.key}" ${d.careerTasks && d.careerTasks[t.key]?'checked':''}> ${t.label}</label>`).join('')}
          </div>
        </label>
        <label class="field" style="margin-top:12px;max-width:220px;"><span>Focus hours</span><input type="number" id="f-focus" min="0" step="0.5" value="${d.focusHours??''}"></label>
      </div>
    </details>

    <details class="today-section">
      <summary class="section-title">❤️ Health</summary>
      <div class="card">
        <div class="fields-grid">
          <label class="field"><span>Calories</span><input type="number" id="f-calories" min="0" step="10" value="${d.calories??''}" placeholder="1200"></label>
          <label class="field"><span>Stayed off junk / sodium-heavy food today?</span>
            <div class="toggle-row"><button class="toggle ${d.junkFree? 'active-yes':''}" data-field="junkFree" data-val="true">Clean</button><button class="toggle ${d.junkFree===false? 'active-no':''}" data-field="junkFree" data-val="false">Slipped</button></div>
          </label>
          <label class="field"><span>Ordered Zepto / Zomato today?</span>
            <div class="toggle-row"><button class="toggle ${d.ordered===false? 'active-yes':''}" data-field="ordered" data-val="false">No</button><button class="toggle ${d.ordered? 'active-no':''}" data-field="ordered" data-val="true">Yes</button></div>
          </label>
        </div>
        <label class="field" id="spentRow" style="margin-top:10px;max-width:220px;" ${d.ordered? '':'hidden'}><span>₹ Spent on that order</span><input type="number" id="f-spent" min="0" step="10" value="${d.amountSpent??''}" placeholder="0"></label>
        <div class="section-title" style="margin:18px 0 8px;">Craving log</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="cravingTrigger" placeholder="trigger e.g. 4pm slump, stress" style="flex:1;">
          <button class="btn secondary" id="addResisted">Resisted</button>
          <button class="btn secondary" id="addSlipped">Slipped</button>
        </div>
        <div class="craving-list" id="cravingList"></div>
      </div>
    </details>

    <details class="today-section">
      <summary class="section-title">\u{1F4B0} Finance</summary>
      <div class="card">
        <div class="fields-grid">
          <label class="field"><span>₹ Spent today (anything else — shopping, outings, etc.)</span><input type="number" id="f-otherspend" min="0" step="10" value="${d.otherSpend??''}" placeholder="0"></label>
          <label class="field"><span>What was it for?</span><input type="text" id="f-othernote" value="${d.otherSpendNote||''}" placeholder="e.g. coffee, clothes, movie"></label>
        </div>
      </div>
    </details>

    <div class="card" style="margin-top:14px;">
      <label class="field"><span>Notes</span><textarea id="f-notes" placeholder="anything about today worth remembering">${d.notes||''}</textarea></label>
    </div>

    <div style="margin-top:16px;display:flex;justify-content:space-between;gap:10px;">
      <button class="btn ghost" id="clearDay">Clear this day's entry</button>
      <button class="btn" id="saveDay">Save today's log</button>
    </div>
  `;

  renderCravingList(d.cravings||[]);
  wireTimeField('f-wake');
  wireTimeField('f-sleep');
  const moodInput = host.querySelector('#f-mood'), moodVal = host.querySelector('#moodVal');
  if(moodInput) moodInput.addEventListener('input', ()=>{ moodVal.textContent = MOOD_EMOJI[Number(moodInput.value)-1]; });

  const relaxPicker = host.querySelector('#relaxPicker');
  if(relaxPicker) relaxPicker.addEventListener('change', ()=>{
    const chosen = RELAX.find(r=>r.name===relaxPicker.value);
    state.days[todayDate] = {...(state.days[todayDate]||{}), relaxChoice: chosen.name};
    writeDocQuiet({col:'days',id:todayDate}, {relaxChoice: chosen.name});
    document.getElementById('relaxCardIco').textContent = chosen.ico;
    document.getElementById('relaxCardDesc').textContent = chosen.desc;
  });

  host.querySelectorAll('.career-task-chk').forEach(cb=>cb.addEventListener('change', ()=>{
    const cur = state.days[todayDate]||{};
    const tasks = {...(cur.careerTasks||{}), [cb.dataset.key]: cb.checked};
    state.days[todayDate] = {...cur, careerTasks: tasks};
    writeDocQuiet({col:'days',id:todayDate}, {careerTasks: tasks});
  }));

  host.querySelector('#dateInput').addEventListener('change', e=>{ todayDate=e.target.value; renderToday(); });
  host.querySelectorAll('.toggle[data-field]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const field=btn.dataset.field, val = btn.dataset.val==='true';
      if(field==='relaxDone'){
        const cur=state.days[todayDate]||{};
        const next = !cur.relaxDone;
        state.days[todayDate] = {...cur, relaxDone: next};
        writeDocQuiet({col:'days',id:todayDate},{relaxDone: next});
        btn.textContent = next? 'Done ✓':'Mark done';
        btn.classList.toggle('active-yes', next);
        return;
      }
      const cur = (state.days[todayDate]||{})[field];
      const next = cur===val ? null : val;
      state.days[todayDate] = {...(state.days[todayDate]||{}), [field]: next};
      writeDocQuiet({col:'days',id:todayDate},{[field]: next});
      // update this toggle pair's classes in place, no full re-render
      host.querySelectorAll(`.toggle[data-field="${field}"]`).forEach(b=>{
        b.classList.remove('active-yes','active-no');
        const bVal = b.dataset.val==='true';
        if(next===true && bVal) b.classList.add(field==='ordered'?'active-no':'active-yes');
        if(next===false && !bVal) b.classList.add(field==='ordered'?'active-yes':'active-no');
      });
      if(field==='ordered'){
        const row = document.getElementById('spentRow');
        if(row) row.hidden = !next;
      }
      if(field==='junkFree' && next!==null){
        showJunkFeedback(next);
      }
    });
  });
  host.querySelector('#addResisted').addEventListener('click', ()=>addCraving(true));
  host.querySelector('#addSlipped').addEventListener('click', ()=>addCraving(false));
  host.querySelector('#saveDay').addEventListener('click', saveDayFromForm);
  host.querySelector('#clearDay').addEventListener('click', ()=>{
    if(confirm(`Clear everything logged for ${todayDate}? This can't be undone.`)){
      clearDoc({col:'days', id:todayDate}).then(renderAll);
    }
  });
}

function addCraving(resisted){
  const input = document.getElementById('cravingTrigger');
  const trigger = input.value.trim() || (resisted?'craving':'slip');
  const cur = state.days[todayDate]||{};
  const list = (cur.cravings||[]).concat([{time:new Date().toTimeString().slice(0,5), trigger, resisted}]);
  writeDocQuiet({col:'days',id:todayDate},{cravings:list});
  input.value='';
  renderCravingList(list);
}
function renderCravingList(list){
  const el = document.getElementById('cravingList'); if(!el) return;
  if(!list.length){ el.innerHTML = `<div class="faint" style="font-size:12px;">No cravings logged yet today.</div>`; return; }
  el.innerHTML = list.map((c,i)=>`<div class="craving-item">${c.resisted?'✅':'⚠️'} ${c.time} &middot; ${c.trigger} <button data-i="${i}">remove</button></div>`).join('');
  el.querySelectorAll('button[data-i]').forEach(b=>b.addEventListener('click',()=>{
    const i=Number(b.dataset.i); const cur=state.days[todayDate]||{}; const list2=(cur.cravings||[]).slice(); list2.splice(i,1);
    writeDocQuiet({col:'days',id:todayDate},{cravings:list2}); renderCravingList(list2);
  }));
}

function saveDayFromForm(){
  const g = id => document.getElementById(id);
  const val = id => g(id) ? g(id).value : undefined;
  const patch = {
    wake: readTimePicker('f-wake'), sleep: readTimePicker('f-sleep'),
    steps: val('f-steps')? Number(val('f-steps')):null,
    water: val('f-water')? Number(val('f-water')):null,
    calories: val('f-calories')? Number(val('f-calories')):null,
    screenTime: val('f-screen')!=='' ? Number(val('f-screen')):null,
    focusHours: val('f-focus')!=='' ? Number(val('f-focus')):null,
    weight: val('f-weight')!=='' ? Number(val('f-weight')):null,
    mood: val('f-mood')? Number(val('f-mood')):null,
    amountSpent: val('f-spent')!=='' && val('f-spent')!==undefined ? Number(val('f-spent')):0,
    otherSpend: val('f-otherspend')!=='' ? Number(val('f-otherspend')):0,
    otherSpendNote: val('f-othernote')||'',
    notes: val('f-notes')||'',
  };
  writeDoc({col:'days',id:todayDate}, patch).then(()=>{
    const sc = scoreForDay(state.days[todayDate], todayDate);
    toast(sc? `Saved — score ${sc.score}/100${sc.flags.length? ' — '+sc.flags.length+' red flag'+(sc.flags.length>1?'s':''):''}` : 'Saved');
    if(sc && sc.score>=90 && window.confetti){
      confetti({particleCount:110, spread:75, origin:{y:0.6}, colors:['#e2601f','#c98a1f','#1f8a57']});
    }
    // Catch-up repayment: hitting the boosted bar on a debt day pays down 1 day of debt.
    if(sc && catchUpDebt()>0 && sc.core.steps && sc.core.career){
      const repaid = (state.profile.catchUpRepaid||0)+1;
      writeDocQuiet({col:'profile',id:'main'}, {catchUpRepaid: repaid}).then(()=>{
        state.profile.catchUpRepaid = repaid;
        const remaining = catchUpDebt();
        toast(remaining>0 ? `Caught up 1 day — ${remaining} day${remaining>1?'s':''} of debt left` : `Fully caught up! \u{1F525}`);
        if(window.confetti) confetti({particleCount:160, spread:100, origin:{y:0.5}, colors:['#4f8cff','#8a5cf6','#1f8a57']});
        renderDashboard();
      });
    }
    renderDashboard();
  });
}

/* ======================= HISTORY ======================= */
function scorePillClass(score){
  if(score>=85) return 'good';
  if(score>=60) return 'warn';
  return 'bad';
}
function renderHistory(){
  const host=document.getElementById('view-history'); if(!host) return;
  const days = allDaysSorted().slice().reverse(); // most recent first
  if(!days.length){
    host.innerHTML = `<div class="card faint" style="text-align:center;padding:40px;">Nothing logged yet — go fill in the Today tab and it'll show up here.</div>`;
    return;
  }
  const rows = days.map(d=>{
    const sc = scoreForDay(d, d.date);
    const dow = new Date(d.date+'T00:00:00').toLocaleDateString(undefined,{weekday:'short'});
    return `<tr>
      <td>${fmtShort(new Date(d.date+'T00:00:00'))} <span class="faint">${dow}</span></td>
      <td>${sc? `<span class="score-pill ${scorePillClass(sc.score)}">${sc.score}</span>` : '--'}</td>
      <td>${fmtTime(d.wake)}</td>
      <td>${fmtTime(d.sleep)}</td>
      <td>${d.steps!=null? Number(d.steps).toLocaleString() : '--'}</td>
      <td>${d.water!=null? d.water+'L' : '--'}</td>
      <td>${d.calories!=null? d.calories : '--'}</td>
      <td>${d.junkFree===true?'✅':d.junkFree===false?'❌':'--'}</td>
      <td title="${d.careerTasks? CAREER_TASKS.filter(t=>d.careerTasks[t.key]).map(t=>t.label).join(', ')||'none':''}">${d.careerTasks? (Object.values(d.careerTasks).some(Boolean)?'✅':'❌') : '--'}</td>
      <td>${d.weight!=null? d.weight+'kg' : '--'}</td>
      <td>${d.ordered? '₹'+(d.amountSpent||0) : (d.ordered===false? '—' : '--')}</td>
      <td>${sc && sc.flags.length? `<span style="color:var(--bad);">${sc.flags.length} ⚠</span>` : (d.date in state.days? '✅':'--')}</td>
      <td><button class="edit-link" data-date="${d.date}">Edit</button></td>
    </tr>`;
  }).join('');
  host.innerHTML = `
    <div class="section-title" style="margin-top:0;">Every day you've logged — ${days.length} of ${TOTAL_DAYS}</div>
    <div class="table-wrap">
      <table class="history">
        <thead><tr>
          <th>Date</th><th>Score</th><th>Wake</th><th>Sleep</th><th>Steps</th><th>Water</th><th>Cal</th><th>Clean</th><th>Career</th><th>Weight</th><th>Spent</th><th>Flags</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  host.querySelectorAll('.edit-link').forEach(btn=>btn.addEventListener('click', ()=>{
    todayDate = btn.dataset.date;
    activeTab = 'today';
    renderAll();
    window.scrollTo({top:0,behavior:'smooth'});
  }));
}

/* ======================= CAREER ======================= */
function renderCareer(){
  const host=document.getElementById('view-career'); if(!host) return;
  const nameRow = (wk, field, tag, defaultName, wdata, done)=>{
    const nameField = field+'Name';
    const value = wdata[nameField] || defaultName;
    return `<div class="proj-row"><input type="checkbox" class="chk" data-wk="${wk}" data-field="${field}" ${done?'checked':''}>
      <div style="flex:1;"><div class="proj-tag">${tag}</div>
        <input type="text" class="proj-name-edit ${done?'done':''}" data-wk="${wk}" data-field="${nameField}" value="${value.replace(/"/g,'&quot;')}">
      </div></div>`;
  };
  const cards = WEEKS.map((w,i)=>{
    const wk=i+1; const wdata = state.career[String(wk)]||{};
    const startD = fmtShort(addDays(START,(wk-1)*7)), endD = fmtShort(addDays(START,Math.min(wk*7-1,TOTAL_DAYS-1)));
    const isCur = wk===CURRENT_WEEK;
    return `<div class="week-card ${isCur?'current':''}">
      <div class="week-head"><div><div class="week-num">Week ${wk}</div><div class="week-theme">${w.theme}</div></div><div class="week-dates">${startD} &ndash; ${endD}</div></div>
      ${nameRow(wk,'production','production',w.production,wdata,wdata.production)}
      ${nameRow(wk,'mini1','mini 1',w.mini1,wdata,wdata.mini1)}
      ${nameRow(wk,'mini2','mini 2',w.mini2,wdata,wdata.mini2)}
      <div class="posts-row">LinkedIn posts this week <input type="number" min="0" max="4" data-wk="${wk}" data-field="posts" value="${wdata.posts??0}"> / 4</div>
    </div>`;
  }).join('');
  host.innerHTML = `<div class="section-title" style="margin-top:0;">12-week build curriculum + review week <span class="faint" style="text-transform:none;font-weight:400;">— project names are editable, click in and type</span></div><div class="grid grid-3">${cards}</div>`;
  host.querySelectorAll('.chk').forEach(c=>c.addEventListener('change', ()=>{
    writeDoc({col:'career', id:c.dataset.wk}, {[c.dataset.field]: c.checked}).then(renderCareer);
  }));
  host.querySelectorAll('input[type=number][data-field=posts]').forEach(inp=>inp.addEventListener('change', ()=>{
    writeDoc({col:'career', id:inp.dataset.wk}, {posts: Number(inp.value)||0}).then(renderDashboard);
  }));
  host.querySelectorAll('.proj-name-edit').forEach(inp=>inp.addEventListener('blur', ()=>{
    const val = inp.value.trim();
    writeDoc({col:'career', id:inp.dataset.wk}, {[inp.dataset.field]: val || null});
  }));
}

/* ======================= DSA SHEET ======================= */
function renderDSA(){
  const host=document.getElementById('view-dsa'); if(!host) return;
  const byCat = {};
  DSA_PROBLEMS.forEach(p=>{ (byCat[p.cat] = byCat[p.cat]||[]).push(p); });
  const totalDone = DSA_PROBLEMS.filter(p=>state.dsa[p.id] && state.dsa[p.id].done).length;
  const groups = Object.entries(byCat).map(([cat, probs])=>{
    const doneCount = probs.filter(p=>state.dsa[p.id] && state.dsa[p.id].done).length;
    const rows = probs.map(p=>{
      const entry = state.dsa[p.id] || {};
      const done = !!entry.done;
      const name = entry.name || p.name;
      return `<div class="skill-item ${done?'done':''}">
        <input type="checkbox" class="chk dsa-chk" data-id="${p.id}" ${done?'checked':''}>
        <input type="text" class="dsa-name-edit" data-id="${p.id}" value="${name.replace(/"/g,'&quot;')}">
      </div>`;
    }).join('');
    return `<div class="skill-group"><div class="bar-row"><strong style="color:var(--text);font-size:14.5px;">${cat}</strong><span>${doneCount}/${probs.length}</span></div><div class="bar" style="margin-bottom:10px;"><div style="width:${doneCount/probs.length*100}%"></div></div>${rows}</div>`;
  }).join('');
  host.innerHTML = `
    <div class="section-title" style="margin-top:0;">90-problem DSA sheet — ${totalDone}/90 solved <span class="faint" style="text-transform:none;font-weight:400;">— names are editable, swap any slot for your own pick</span></div>
    <div class="card"><div class="bar-row"><span>Overall progress</span><span class="num">${totalDone} / 90</span></div><div class="bar"><div style="width:${totalDone/90*100}%"></div></div></div>
    <div class="card" style="margin-top:14px;">${groups}</div>
  `;
  host.querySelectorAll('.dsa-chk').forEach(c=>c.addEventListener('change', ()=>{
    const cur = state.dsa[c.dataset.id] || {};
    writeDoc({col:'dsa', id:'checklist'}, {[c.dataset.id]: {...cur, done: c.checked}}).then(renderDSA);
  }));
  host.querySelectorAll('.dsa-name-edit').forEach(inp=>inp.addEventListener('blur', ()=>{
    const cur = state.dsa[inp.dataset.id] || {};
    const val = inp.value.trim();
    writeDoc({col:'dsa', id:'checklist'}, {[inp.dataset.id]: {...cur, name: val || null}});
  }));
}

/* ======================= AI ENGINEER ROADMAP (game map) ======================= */
function aieXP(){ return AIE_NODES.reduce((s,n)=> s + (state.aie[n.id]&&state.aie[n.id].done ? n.xp : 0), 0); }
function aieLevel(xp){
  let lvl=1;
  for(let i=1;i<AIE_LEVELS.length;i++){ if(xp>=AIE_LEVELS[i]) lvl=i+1; }
  return Math.min(lvl, AIE_RANKS.length);
}
function aieStatus(index){
  if(index===0) return (state.aie['n1']&&state.aie['n1'].done) ? 'done' : 'current';
  const prevDone = state.aie[AIE_NODES[index-1].id] && state.aie[AIE_NODES[index-1].id].done;
  const thisDone = state.aie[AIE_NODES[index].id] && state.aie[AIE_NODES[index].id].done;
  if(thisDone) return 'done';
  if(prevDone) return 'current';
  return 'locked';
}
function renderAIE(){
  const host=document.getElementById('view-aie'); if(!host) return;
  const xp = aieXP();
  const totalXP = AIE_NODES.reduce((s,n)=>s+n.xp,0);
  const level = aieLevel(xp);
  const rank = AIE_RANKS[level-1];
  const nextThreshold = AIE_LEVELS[level] ?? totalXP;
  const prevThreshold = AIE_LEVELS[level-1] ?? 0;
  const levelPct = nextThreshold>prevThreshold ? Math.min(100,((xp-prevThreshold)/(nextThreshold-prevThreshold))*100) : 100;
  const doneCount = AIE_NODES.filter(n=>state.aie[n.id]&&state.aie[n.id].done).length;

  const months = [1,2,3];
  const nodesHtml = months.map(m=>{
    const inMonth = AIE_NODES.map((n,i)=>({n,i})).filter(x=>x.n.month===m);
    const rows = inMonth.map(({n,i})=>{
      const status = aieStatus(i);
      const flip = i%2===1;
      return `<div class="aie-row ${flip?'flip':''} ${status}" data-idx="${i}">
        <button class="aie-node ${status}" tabindex="-1">
          <span class="aie-node-icon">${status==='locked'?'\u{1F512}':n.icon}</span>
          <span class="aie-node-num">${i+1}</span>
        </button>
        <div class="aie-node-info">
          <div class="aie-node-title">${n.title}</div>
          <div class="aie-node-xp">${n.xp} XP ${status==='done'?'· cleared ✓':status==='locked'?'· locked':'· up next'}</div>
        </div>
      </div>`;
    }).join('<div class="aie-connector"></div>');
    return `<div class="aie-month"><div class="aie-month-label">Month ${m}</div>${rows}</div>`;
  }).join('<div class="aie-connector aie-month-gap"></div>');

  host.innerHTML = `
    <div class="aie-layout">
      <div class="aie-side">
        <div class="aie-hud">
          <div class="aie-hud-level">
            <div class="aie-level-badge">Lv ${level}</div>
            <div><div style="font-family:'Fraunces',serif;font-size:17px;font-weight:600;">${rank}</div><div class="faint" style="font-size:12px;">${doneCount}/${AIE_NODES.length} nodes cleared</div></div>
          </div>
          <div>
            <div class="bar-row"><span>XP</span><span class="num">${xp} / ${level<AIE_RANKS.length? nextThreshold : totalXP}</span></div>
            <div class="bar"><div style="width:${levelPct}%"></div></div>
          </div>
        </div>
        <div id="aieDetail"></div>
      </div>
      <div class="aie-main">
        <div class="aie-map">${nodesHtml}</div>
      </div>
    </div>
  `;

  host.querySelectorAll('.aie-row').forEach(row=>{
    row.addEventListener('click', ()=>{
      const idx = Number(row.dataset.idx);
      if(aieStatus(idx)==='locked'){ toast('Clear the previous node first'); return; }
      aieSelected = AIE_NODES[idx].id;
      renderAieDetail();
      document.getElementById('aieDetail').scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });

  if(aieSelected) renderAieDetail();
}

function renderAieDetail(){
  const host = document.getElementById('aieDetail'); if(!host) return;
  const idx = AIE_NODES.findIndex(n=>n.id===aieSelected);
  if(idx<0){ host.innerHTML=''; return; }
  const n = AIE_NODES[idx];
  const status = aieStatus(idx);
  const done = status==='done';
  host.innerHTML = `
    <div class="card aie-detail-card" style="margin-top:16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="font-size:30px;">${n.icon}</div>
        <div><div class="faint" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Node ${idx+1} of ${AIE_NODES.length} · ${n.xp} XP</div><h3 style="margin:2px 0 0;font-size:19px;">${n.title}</h3></div>
      </div>
      <div class="section-title" style="margin:14px 0 6px;">Concept</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text-dim);">${n.concept}</p>
      <div class="section-title" style="margin:14px 0 6px;">What to build</div>
      <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text-dim);">${n.build}</p>
      ${n.resources.length? `<div class="section-title" style="margin:14px 0 6px;">Resources</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${n.resources.map(r=>`<a href="${r.url}" target="_blank" rel="noopener" class="btn secondary" style="font-size:12.5px;padding:7px 12px;">${r.name} ↗</a>`).join('')}</div>` : ''}
      <div style="margin-top:18px;display:flex;justify-content:flex-end;">
        <button class="btn ${done?'secondary':''}" id="aieComplete">${done? 'Mark as not done' : 'Mark as learned ✔'}</button>
      </div>
    </div>
  `;
  host.querySelector('#aieComplete').addEventListener('click', ()=>{
    const xpBefore = aieXP(); const levelBefore = aieLevel(xpBefore);
    const newDone = !done;
    writeDoc({col:'aie', id:'progress'}, {[n.id]: {done:newDone}}).then(()=>{
      renderAIE();
      if(newDone){
        const xpAfter = aieXP(); const levelAfter = aieLevel(xpAfter);
        if(window.confetti) confetti({particleCount:120, spread:80, origin:{y:0.6}, colors:['#4f8cff','#8a5cf6','#e2601f']});
        toast(levelAfter>levelBefore ? `Node cleared — Level up! Lv ${levelAfter}: ${AIE_RANKS[levelAfter-1]}` : `Node cleared — +${n.xp} XP`);
      }
    });
  });
}

/* ======================= SKILLS ======================= */
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'_');}
function renderSkills(){
  const host=document.getElementById('view-skills'); if(!host) return;
  const groups = Object.entries(SKILLS).map(([group,items])=>{
    const total=items.length;
    const doneCount = items.filter(it=>state.skills[slug(group+'_'+it)]).length;
    const rows = items.map(it=>{
      const id = slug(group+'_'+it); const done = !!state.skills[id];
      return `<div class="skill-item ${done?'done':''}"><input type="checkbox" class="chk" data-id="${id}" ${done?'checked':''}><span class="skill-label">${it}</span></div>`;
    }).join('');
    return `<div class="skill-group"><div class="bar-row"><strong style="color:var(--text);font-size:14.5px;">${group}</strong><span>${doneCount}/${total}</span></div><div class="bar" style="margin-bottom:10px;"><div style="width:${doneCount/total*100}%"></div></div>${rows}</div>`;
  }).join('');
  host.innerHTML = `<div class="card">${groups}</div>`;
  host.querySelectorAll('.chk').forEach(c=>c.addEventListener('change', ()=>{
    writeDoc({col:'skills',id:'checklist'},{[c.dataset.id]: c.checked}).then(renderSkills);
  }));
}

/* ======================= RELAX ======================= */
function renderRelax(){
  const host=document.getElementById('view-relax'); if(!host) return;
  const cards = RELAX.map((r)=>{
    const isToday = relaxForIndex(TODAY_IDX)===r;
    return `<div class="relax-card ${isToday?'today':''}"><div class="relax-ico">${r.ico}</div><div class="relax-name">${r.name}</div><div class="relax-desc">${r.desc}</div></div>`;
  }).join('');
  const doneCount = Object.values(state.days).filter(d=>d.relaxDone).length;
  host.innerHTML = `
    <div class="section-title" style="margin-top:0;">Your 10 activities, on rotation</div>
    <div class="grid grid-4">${cards}</div>
    <div class="section-title">Progress</div>
    <div class="card"><div class="bar-row"><span>Days you unplugged into something real</span><span class="num">${doneCount} / ${TOTAL_DAYS}</span></div><div class="bar"><div style="width:${Math.min(100,doneCount/TOTAL_DAYS*100)}%"></div></div></div>
  `;
}

/* ======================= FINANCE ======================= */
function spendCumulativeChart(days){
  const sorted = days.filter(d=>d.ordered || Number(d.otherSpend||0)>0);
  if(sorted.length<2) return `<div class="faint" style="font-size:13px;">Log a couple of spend days to see the running total climb here.</div>`;
  let running=0;
  const pts = sorted.map(d=>{ running += (d.ordered?Number(d.amountSpent||0):0) + Number(d.otherSpend||0); return running; });
  const max = Math.max(...pts);
  const W=600,H=70,pad=6;
  const x = i => pad + i*(W-2*pad)/(pts.length-1);
  const y = v => H-pad - (max===0?0:(v/max))*(H-2*pad);
  const path = pts.map((v,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = path + ` L${x(pts.length-1).toFixed(1)},${H-pad} L${x(0).toFixed(1)},${H-pad} Z`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:70px;">
    <path d="${area}" fill="var(--bad)" opacity="0.12"/>
    <path d="${path}" fill="none" stroke="var(--bad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(pts.length-1)}" cy="${y(pts[pts.length-1])}" r="4" fill="var(--bad)"/>
  </svg>
  <div class="bar-row" style="margin-top:4px;"><span>Day 1 of tracking</span><span>₹${pts[pts.length-1].toLocaleString()} spent total</span></div>`;
}

function renderFinance(){
  const host=document.getElementById('view-finance'); if(!host) return;
  const days = allDaysSorted();
  const ordersTotal = days.reduce((s,d)=>s+(d.ordered? Number(d.amountSpent||0):0),0);
  const otherTotal = days.reduce((s,d)=>s+Number(d.otherSpend||0),0);
  const combinedTotal = ordersTotal + otherTotal;
  const orderCount = days.filter(d=>d.ordered).length;
  const noOrderStreak = computeNoOrderStreak();
  const cap = state.profile.spendCap || 3000;
  const weekly = Array.from({length:13},(_,w)=>{
    const from=addDays(START,w*7), to=addDays(START,Math.min(w*7+6,TOTAL_DAYS-1));
    const inWeek = days.filter(d=>{const dd=new Date(d.date+'T00:00:00'); return dd>=from && dd<=to;});
    const orders = inWeek.filter(d=>d.ordered).reduce((s,d)=>s+Number(d.amountSpent||0),0);
    const other = inWeek.reduce((s,d)=>s+Number(d.otherSpend||0),0);
    return {w:w+1, orders, other, total:orders+other};
  });
  const maxSum = Math.max(1,...weekly.map(w=>w.total));
  const thisWeekIdx = CURRENT_WEEK-1;
  const thisWeek = weekly[thisWeekIdx] || {total:0};
  const topSpendDays = days.filter(d=>d.ordered || Number(d.otherSpend||0)>0)
    .map(d=>({date:d.date, amt:(d.ordered?Number(d.amountSpent||0):0)+Number(d.otherSpend||0), note: d.otherSpendNote||(d.ordered?'Zepto/Zomato':'')}))
    .sort((a,b)=>b.amt-a.amt).slice(0,5);
  host.innerHTML = `
    <div class="hero" style="grid-template-columns:1fr;text-align:left;">
      <div>
        <div class="stat"><div class="num" id="moneyNum">0</div><div class="lbl">Total spent so far — orders + everything else (${orderCount} order${orderCount===1?'':'s'})</div></div>
        <div style="margin-top:12px;"><div class="bar-row"><span>This week's spend vs. your weekly cap</span><span>₹${thisWeek.total.toLocaleString()} / ${cap.toLocaleString()}</span></div><div class="bar"><div style="width:${Math.min(100,thisWeek.total/cap*100)}%;background:${thisWeek.total>cap?'linear-gradient(90deg,var(--bad),#ff8a8a)':'linear-gradient(90deg,var(--accent),var(--accent2))'}"></div></div></div>
        <label class="field" style="margin-top:14px;max-width:220px;"><span>Weekly spend cap (₹, all spending)</span><input type="number" id="goalInput" min="0" step="100" value="${cap}"></label>
        <div class="streak-chip" style="margin-top:14px;">\u{1F6AB} ${noOrderStreak}-day streak without ordering</div>
      </div>
    </div>

    <div class="section-title">Weekly spend — orders vs. everything else</div>
    <div class="card">
      <div style="display:flex;align-items:flex-end;gap:6px;height:120px;">
        ${weekly.map(w=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="width:100%;display:flex;flex-direction:column-reverse;height:90px;">
            <div style="width:100%;background:var(--bad);border-radius:${w.other>0?'0':'4px 4px'} 0 0;height:${maxSum?Math.max(w.orders>0?2:0,w.orders/maxSum*90):0}px;"></div>
            <div style="width:100%;background:var(--accent2);border-radius:4px 4px 0 0;height:${maxSum?Math.max(w.other>0?2:0,w.other/maxSum*90):0}px;"></div>
          </div>
          <div class="faint" style="font-size:10px;">W${w.w}</div>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:11.5px;" class="muted">
        <span><span style="display:inline-block;width:9px;height:9px;background:var(--bad);border-radius:2px;margin-right:5px;"></span>Zepto/Zomato orders (₹${ordersTotal.toLocaleString()})</span>
        <span><span style="display:inline-block;width:9px;height:9px;background:var(--accent2);border-radius:2px;margin-right:5px;"></span>Other spend (₹${otherTotal.toLocaleString()})</span>
      </div>
    </div>

    <div class="section-title">Running total over time</div>
    <div class="card">${spendCumulativeChart(days)}</div>

    ${topSpendDays.length? `
    <div class="section-title">Your 5 biggest spend days</div>
    <div class="card">
      ${topSpendDays.map(t=>`<div class="bar-row" style="margin-bottom:0;padding:6px 0;border-top:1px solid var(--line);"><span>${fmtShort(new Date(t.date+'T00:00:00'))} ${t.note?'— '+t.note:''}</span><span class="num">₹${t.amt.toLocaleString()}</span></div>`).join('')}
    </div>` : ''}
  `;
  animateNumber(document.getElementById('moneyNum'), combinedTotal);
  document.getElementById('goalInput').addEventListener('change', e=>{
    writeDoc({col:'profile', id:'main'}, {spendCap: Number(e.target.value)||0}).then(renderFinance);
  });
}

/* ======================= MILESTONES ======================= */
function renderMilestones(){
  const host=document.getElementById('view-milestones'); if(!host) return;
  const cards = MILESTONES.map(m=>{
    const d = state.milestones[String(m)] || {};
    const milestoneDate = dateOfIndex(m);
    const reached = TODAY_IDX >= m;
    const filled = d.weight || d.hairNote || d.portfolioNote || d.followers;
    const badge = filled ? '<span class="badge done">Recorded</span>' : (reached ? '<span class="badge open">Open</span>' : '<span class="badge locked">Upcoming</span>');
    return `<div class="milestone-card ${reached?'':'locked'}">
      <div class="milestone-head"><h3 style="margin:0;font-size:17px;">Day ${m} &middot; ${fmtShort(milestoneDate)}</h3>${badge}</div>
      <div class="fields-grid">
        <label class="field"><span>Weight (kg)</span><input type="number" step="0.1" data-m="${m}" data-field="weight" value="${d.weight??''}" ${reached?'':'disabled'}></label>
        <label class="field"><span>LinkedIn followers</span><input type="number" data-m="${m}" data-field="followers" value="${d.followers??''}" ${reached?'':'disabled'}></label>
      </div>
      <label class="field" style="margin-top:10px;"><span>Hair / scalp note</span><input type="text" data-m="${m}" data-field="hairNote" value="${d.hairNote||''}" ${reached?'':'disabled'} placeholder="shedding, regrowth, routine followed..."></label>
      <label class="field" style="margin-top:10px;"><span>Portfolio / GitHub snapshot</span><input type="text" data-m="${m}" data-field="portfolioNote" value="${d.portfolioNote||''}" ${reached?'':'disabled'} placeholder="projects shipped, repo count, resume status..."></label>
    </div>`;
  }).join('');
  host.innerHTML = `<div class="grid grid-3">${cards}</div>`;
  host.querySelectorAll('input[data-m]').forEach(inp=>inp.addEventListener('change', ()=>{
    const m=inp.dataset.m, field=inp.dataset.field;
    const v = (field==='weight'||field==='followers') ? Number(inp.value)||null : inp.value;
    writeDoc({col:'milestones', id:m}, {[field]: v}).then(()=>{
      if(window.confetti) confetti({particleCount:150,spread:90,origin:{y:0.5},colors:['#e2601f','#c98a1f','#1f8a57','#b3780f']});
      renderMilestones();
    });
  }));
}

/* ======================= WEEKLY REVIEW ======================= */
function renderWeekly(){
  const host=document.getElementById('view-weekly'); if(!host) return;
  const cards = Array.from({length:13},(_,i)=>{
    const wk=i+1; const w = state.weekly[String(wk)]||{};
    const startD=fmtShort(addDays(START,(wk-1)*7)), endD=fmtShort(addDays(START,Math.min(wk*7-1,TOTAL_DAYS-1)));
    return `<div class="weekly-card">
      <h3>Week ${wk} <span class="faint" style="font-weight:400;font-size:12.5px;">${startD} &ndash; ${endD}</span></h3>
      <div class="weekly-fields">
        <label class="field"><span>Body (weight / steps / sleep)</span><textarea data-wk="${wk}" data-field="body">${w.body||''}</textarea></label>
        <label class="field"><span>Career (shipped / posted)</span><textarea data-wk="${wk}" data-field="career">${w.career||''}</textarea></label>
        <label class="field"><span>Money (saved / spent)</span><textarea data-wk="${wk}" data-field="money">${w.money||''}</textarea></label>
        <label class="field"><span>Mind (one honest note)</span><textarea data-wk="${wk}" data-field="mind">${w.mind||''}</textarea></label>
      </div>
    </div>`;
  }).join('');
  host.innerHTML = `<div class="section-title" style="margin-top:0;">Sunday ritual &middot; four short questions, every week</div><div class="grid grid-2">${cards}</div>`;
  host.querySelectorAll('textarea[data-wk]').forEach(ta=>ta.addEventListener('blur', ()=>{
    writeDoc({col:'weekly', id:ta.dataset.wk}, {[ta.dataset.field]: ta.value});
  }));
}

/* ======================= EXPORT TO EXCEL ======================= */
function exportExcel(){
  if(!window.XLSX){ toast('Export library still loading, try again'); return; }
  const wb = XLSX.utils.book_new();
  const blank = v => (v===undefined || v===null || v==='') ? '' : v;
  const days = allDaysSorted().map(d=>{
    const sc = scoreForDay(d, d.date);
    const resisted = (d.cravings||[]).filter(c=>c.resisted).length;
    const slipped = (d.cravings||[]).filter(c=>!c.resisted).length;
    return {
      Date: d.date,
      // Physical
      Wake: blank(d.wake?fmtTime(d.wake):''), Sleep: blank(d.sleep?fmtTime(d.sleep):''), Steps: blank(d.steps), 'Water (L)': blank(d.water), 'Weight (kg)': blank(d.weight),
      // Mental
      'Screen Time (h)': blank(d.screenTime), Mood: blank(d.mood), 'Relax Activity': blank(d.relaxChoice), 'Relax Done': d.relaxDone?'Yes':'',
      // Career
      DSA: d.careerTasks&&d.careerTasks.dsa?'Yes':'', 'LinkedIn Clean-up': d.careerTasks&&d.careerTasks.linkedin?'Yes':'', 'GitHub Clean-up': d.careerTasks&&d.careerTasks.github?'Yes':'', 'Project Work': d.careerTasks&&d.careerTasks.project?'Yes':'', 'Post Work': d.careerTasks&&d.careerTasks.posts?'Yes':'', 'Focus Hours': blank(d.focusHours),
      // Health
      Calories: blank(d.calories), 'Junk-Free': d.junkFree===true?'Yes':d.junkFree===false?'No':'', 'Cravings Resisted': resisted||'', 'Cravings Slipped': slipped||'', 'Ordered Food': d.ordered?'Yes':'', 'Order Amount': d.ordered?(d.amountSpent||0):'',
      // Finance
      'Other Spend': d.otherSpend||'', 'Other Spend For': blank(d.otherSpendNote),
      Score: sc?sc.score:'', Notes: blank(d.notes),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(days), 'Daily Log');

  const career = WEEKS.map((w,i)=>{ const c=state.career[String(i+1)]||{}; return {Week:i+1, Theme:w.theme, Production:c.productionName||w.production, 'Prod Done':c.production?'Yes':'', 'Mini 1':c.mini1Name||w.mini1,'Mini1 Done':c.mini1?'Yes':'', 'Mini 2':c.mini2Name||w.mini2, 'Mini2 Done':c.mini2?'Yes':'', 'Posts (of 4)':c.posts||0}; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(career), 'Career');

  const skillsRows=[]; Object.entries(SKILLS).forEach(([g,items])=>items.forEach(it=>skillsRows.push({Group:g, Skill:it, Done: state.skills[slug(g+'_'+it)]?'Yes':''})));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skillsRows), 'Skills');

  const weekly = Array.from({length:13},(_,i)=>{ const w=state.weekly[String(i+1)]||{}; return {Week:i+1, Body:w.body||'', Career:w.career||'', Money:w.money||'', Mind:w.mind||''}; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weekly), 'Weekly Review');

  const miles = MILESTONES.map(m=>{ const d=state.milestones[String(m)]||{}; return {Day:m, Date: iso(dateOfIndex(m)), Weight:d.weight||'', 'LinkedIn Followers':d.followers||'', Hair:d.hairNote||'', Portfolio:d.portfolioNote||''}; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(miles), 'Milestones');

  XLSX.writeFile(wb, `redemption-arc-${iso(TODAY)}.xlsx`);
  toast('Exported to Excel');
}

/* ======================= BOOT ======================= */
if(!CONFIG_IS_PLACEHOLDER){
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, user=>{
    currentUser = user;
    uid = user ? user.uid : null;
    if(user){ subscribeAll(); } else { unsubs.forEach(u=>u()); unsubs=[]; state = {days:{}, career:{}, skills:{}, profile:{}, weekly:{}, milestones:{}}; }
    renderAll();
  });
} else {
  renderGate();
}
