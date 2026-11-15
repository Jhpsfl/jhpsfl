"use client";

/* Bookkeeping is NexaBooks, a Nexa module (run by NexaVision Group, connected to this admin).
   It keeps the sidebar's size and rhythm but wears Nexa's look: dark glass, a blue/violet/cyan
   aurora, a rotating gradient edge and a light sweep, plus a premium mark. Opening it goes through
   /admin/nexabooks, which checks the admin's role on the server and hands over with a one-time link. */
export default function NexaBooksNavItem({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a
      href="/admin/nexabooks"
      className="nbn-item"
      aria-label="Bookkeeping: open NexaBooks, a Nexa premium module"
      onClick={() => onNavigate?.()}
    >
      <span className="nbn-aurora" aria-hidden="true"><i /><i /><i /></span>
      <span className="nbn-shine" aria-hidden="true" />
      <span className="nbn-logo" aria-hidden="true">N</span>
      <span className="nbn-text">
        <span className="nbn-title">Bookkeeping</span>
        <span className="nbn-sub">Connected to JHPS by <b>Nexa</b></span>
      </span>
      <span className="nbn-premium" title="Premium Nexa module">
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9z" /></svg>
        Pro
      </span>
      <style>{CSS}</style>
    </a>
  );
}

const CSS = `
.nbn-item { position: relative; overflow: hidden; isolation: isolate; display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 10px 12px; margin: 2px 0; border-radius: 12px; text-decoration: none; color: #e8eefc;
  font-family: 'DM Sans', sans-serif; background: linear-gradient(135deg, #070b16 0%, #0b1022 55%, #071319 100%);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.16), 0 2px 8px rgba(0, 0, 0, .45);
  transition: transform 200ms cubic-bezier(.2, .7, .2, 1), box-shadow 200ms ease; }
.nbn-item::before { content: ''; position: absolute; inset: 0; z-index: 2; border-radius: 12px; padding: 1.25px; pointer-events: none;
  background: conic-gradient(from var(--nbn-a, 0deg), #7dd3fc, #a78bfa, #22d3ee, #2563eb, #7dd3fc);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  animation: nbn-spin 6s linear infinite; }
.nbn-item:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(124, 58, 237, 0.3), 0 2px 8px rgba(0, 0, 0, .45); }
.nbn-item:active { transform: scale(.985); }
.nbn-item:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
.nbn-aurora { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.nbn-aurora i { position: absolute; border-radius: 50%; filter: blur(22px); opacity: .5; animation: nbn-drift 9s ease-in-out infinite; }
.nbn-aurora i:nth-child(1) { width: 90px; height: 90px; left: -24px; top: -46px; background: #2563eb; }
.nbn-aurora i:nth-child(2) { width: 100px; height: 100px; right: 18%; top: -60px; background: #7c3aed; animation-delay: -3s; }
.nbn-aurora i:nth-child(3) { width: 100px; height: 100px; right: -30px; bottom: -64px; background: #06b6d4; animation-delay: -6s; }
.nbn-shine { position: absolute; top: 0; bottom: 0; left: -60%; width: 45%; z-index: 1; pointer-events: none;
  background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, .22) 50%, rgba(255, 255, 255, 0) 70%, transparent 100%);
  transform: skewX(-18deg); animation: nbn-sweep 4.2s ease-in-out infinite; }
.nbn-logo { position: relative; z-index: 1; flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
  font: 800 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #04121f;
  background: linear-gradient(120deg, #7dd3fc, #a78bfa 55%, #22d3ee); box-shadow: 0 0 14px rgba(125, 211, 252, .45); }
.nbn-text { position: relative; z-index: 1; min-width: 0; flex: 1 1 auto; display: grid; gap: 1px; text-align: left; }
.nbn-title { font-size: 14px; font-weight: 700; line-height: 1.2; color: #e8eefc; }
.nbn-sub { font-size: 10.5px; line-height: 1.25; color: #9fb0cc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nbn-sub b { font-weight: 800; background: linear-gradient(120deg, #7dd3fc, #a78bfa 55%, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
.nbn-premium { position: relative; z-index: 1; flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 999px;
  font: 800 9.5px/1 system-ui, -apple-system, 'Segoe UI', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #fff;
  background: linear-gradient(120deg, rgba(125, 211, 252, .22), rgba(167, 139, 250, .32) 55%, rgba(34, 211, 238, .22));
  border: 1px solid rgba(167, 139, 250, .55); animation: nbn-glow 2.8s ease-in-out infinite; }
.nbn-premium svg { color: #fde68a; filter: drop-shadow(0 0 3px rgba(253, 230, 138, .8)); }
@property --nbn-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes nbn-spin { to { --nbn-a: 360deg; } }
@keyframes nbn-sweep { 0% { left: -60%; } 55%, 100% { left: 130%; } }
@keyframes nbn-drift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(12px, 6px) scale(1.1); } }
@keyframes nbn-glow { 0%, 100% { box-shadow: 0 0 8px rgba(167, 139, 250, .35); } 50% { box-shadow: 0 0 16px rgba(125, 211, 252, .55); } }
@media (prefers-reduced-motion: reduce) { .nbn-item::before, .nbn-aurora i, .nbn-premium { animation: none; } .nbn-shine { display: none; } }
`;
