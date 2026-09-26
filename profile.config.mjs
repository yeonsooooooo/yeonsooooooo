// Everything a human edits lives here. Scripts read it; nothing else is hand-written.
// Private repositories are only ever reduced to counts — names never leave collect.mjs.

export default {
  login: 'yeonsooooooo',
  name: { ko: '김연수', en: 'Yeonsoo Kim' },
  host: 'seoul',
  tzOffsetHours: 9, // KST
  tzLabel: 'KST',
  location: 'Seoul, KR',
  tagline: 'I build the operating system for unmanned hotels — from PCB firmware to LLMs.',
  motto: 'We go hard — 불침번 밤새 달려 축지법',
  links: {
    linkedin: 'https://www.linkedin.com/in/%EC%97%B0%EC%88%98-%EA%B9%80-8b8b512bb',
    linkedinLabel: 'linkedin.com/in/연수-김',
  },

  neofetch: {
    os: 'Hotel OS — unmanned hospitality stack',
    kernel: 'TypeScript · Node 22 · Python 3',
    shell: 'zsh + Claude Code',
    stack: 'NestJS · Next.js · React Native · Electron',
  },

  // Languages that inflate byte counts without being "written" code.
  excludeLanguages: ['Jupyter Notebook'],

  // Exploded architecture. First matching layer wins, in this order.
  // Patterns are generic keywords only, so this public file reveals nothing about private repos.
  layers: [
    {
      id: 'intelligence', level: 4, name: 'INTELLIGENCE',
      tech: 'LLM · RAG · vision · speech-to-text · forecasting',
      match: /(^|[^a-z])ai([^a-z]|$)|llm|rag|gpt|langchain|langgraph|llama|transfo|fine.?tun|face|vision|predict|summary|chatbot|fortune/i,
      languages: ['Jupyter Notebook'],
    },
    {
      id: 'silicon', level: 0, name: 'SILICON',
      tech: '30-ch PCB firmware · RTSP / WebRTC camera relay',
      match: /firmware|pcb|rtsp|webrtc|camera|suspension|embed/i,
      languages: ['C++', 'C'],
    },
    {
      id: 'edge', level: 1, name: 'EDGE',
      tech: 'touch kiosks (Electron) · Android agents · RPA',
      match: /kiosk|check.?in|alarm|rpa|automation|record|desktop|agent/i,
      languages: ['Kotlin', 'C#'],
    },
    {
      id: 'core', level: 2, name: 'CORE',
      tech: 'NestJS · MySQL · schedulers · payments · PMS',
      match: /backend|(^|[^a-z])api([^a-z]|$)|server|scheduler|payment|settle|pms|proxy|link|nest/i,
      languages: [],
    },
    {
      id: 'surface', level: 3, name: 'SURFACE',
      tech: 'Next.js dashboards · React Native · SwiftUI · Flutter',
      match: /dashboard|manage|web|front|admin|app|site|home|guide|landing|kpi|mobile|page|board|shop|todo|platform|customer|worker/i,
      languages: ['Swift', 'Dart', 'TypeScript', 'JavaScript', 'HTML', 'CSS'],
    },
  ],

  // `git log --graph` of a career. Newest first. Lanes: 0 main · 1 web · 2 silicon · 3 ai · 4 hotel-os
  lanes: [
    { id: 'main', label: 'main' },
    { id: 'web', label: 'web' },
    { id: 'silicon', label: 'hw' },
    { id: 'ai', label: 'ai' },
    { id: 'hotel', label: 'hotel-os' },
  ],
  timeline: [
    { date: '2026-09', lane: 4, msg: 'feat(kiosk): 24" vertical kiosk v2 · desktop PMS · sales HQ', refs: 'HEAD -> hotel-os' },
    { date: '2026-08', lane: 4, msg: 'feat(ota): direct-booking OTA — NestJS backend · admin · RN/Expo app' },
    { date: '2026-06', lane: 4, msg: 'feat(ops): overbooking · SLA · finalize monitoring dashboards' },
    { date: '2026-05', lane: 4, msg: 'feat(rpa): Windows RPA + screen-record agents' },
    { date: '2026-01', lane: 4, msg: 'feat(android): alarm & ID-verification agents in Kotlin' },
    { date: '2025-12', lane: 2, msg: 'feat(hw): 30-channel PCB firmware (C++)', merge: 4 },
    { date: '2025-08', lane: 4, msg: 'feat(remote): remote management platform for unmanned motels' },
    { date: '2025-07', lane: 2, msg: 'feat(stream): RTSP → WebRTC relay for room cameras', branch: 0 },
    { date: '2025-04', lane: 4, msg: 'feat(kiosk): unmanned check-in kiosk v1 ships' },
    { date: '2025-02', lane: 3, msg: 'feat(vision): face recognition → guest verification', merge: 4 },
    { date: '2025-02', lane: 4, msg: 'feat(hotel-os): worker app (Flutter) + management web', branch: 0 },
    { date: '2024-06', lane: 3, msg: 'feat(agents): LangChain · LangGraph' },
    { date: '2024-05', lane: 3, msg: 'feat(fortune): 사주 AI app, deployed' },
    { date: '2024-04', lane: 3, msg: 'feat(llm): llama fine-tuning · transformer from scratch' },
    { date: '2024-02', lane: 3, msg: 'feat(rag): domain LLM + RAG chatbot', branch: 0 },
    { date: '2023-11', lane: 1, msg: 'merge: 멋쟁이사자처럼 · SW hackathon · table-order app', merge: 0 },
    { date: '2023-07', lane: 2, msg: 'feat(embedded): 임베디드 SW 경진대회 · car suspension', merge: 0 },
    { date: '2023-06', lane: 2, msg: 'chore: C++ on real hardware', branch: 0 },
    { date: '2023-04', lane: 1, msg: 'feat(web): first Django + React services', branch: 0 },
    { date: '2023-01', lane: 0, msg: 'init: hello, world', refs: 'tag: v0.1' },
  ],

  // Commands visitors can run by opening an issue titled "$ <command>".
  shell: {
    buttons: ['fortune', 'whoami', 'ls projects', 'uptime', 'coffee', 'hire'],
  },
};
