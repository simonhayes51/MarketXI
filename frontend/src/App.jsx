import React, { useEffect, useState } from "react";
import { api, setToken, clearToken, getToken } from "./api.js";

function Card({ children }) {
  return <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 shadow">{children}</div>;
}
function Button({ children, onClick, kind="primary", disabled }) {
  const cls = kind === "ghost"
    ? "bg-transparent border border-zinc-700 hover:bg-zinc-800"
    : "bg-emerald-500/90 hover:bg-emerald-500 text-zinc-950";
  return (
    <button disabled={disabled} onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${cls} disabled:opacity-50`}>
      {children}
    </button>
  );
}
function Input(props) {
  return <input {...props} className={`w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-sm outline-none focus:border-emerald-500 ${props.className||""}`} />;
}

function Topbar({ me, onLogout, view, setView }) {
  return (
    <div className="sticky top-0 z-10 backdrop-blur bg-zinc-950/70 border-b border-zinc-900">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="font-black tracking-tight text-lg">
          <span className="text-emerald-400">Market</span>XI
        </div>
        <div className="ml-4 flex gap-2">
          <Button kind={view==="feed"?"primary":"ghost"} onClick={() => setView("feed")}>Feed</Button>
          <Button kind={view==="traders"?"primary":"ghost"} onClick={() => setView("traders")}>Traders</Button>
          {me?.role !== "trader" ? null : (
            <Button kind={view==="studio"?"primary":"ghost"} onClick={() => setView("studio")}>Studio</Button>
          )}
          <Button kind={view==="settings"?"primary":"ghost"} onClick={() => setView("settings")}>Settings</Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <>
              <div className="text-sm text-zinc-300">{me.username} <span className="text-zinc-500">({me.role})</span></div>
              <Button kind="ghost" onClick={onLogout}>Logout</Button>
            </>
          ) : (
            <div className="text-sm text-zinc-400">Not signed in</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    try {
      if (mode === "register") {
        await api.register({ email, username, password });
      }
      const tok = await api.login({ email, password });
      setToken(tok.access_token);
      onAuthed();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold">{mode === "login" ? "Login" : "Create account"}</div>
        <button className="text-sm text-emerald-400 hover:underline" onClick={() => setMode(mode==="login"?"register":"login")}>
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <Input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        {mode === "register" ? (
          <Input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
        ) : null}
        <Input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err ? <div className="text-sm text-red-400">{err}</div> : null}
        <Button onClick={submit}>{mode === "login" ? "Login" : "Register & login"}</Button>
      </div>
    </Card>
  );
}

function Feed({ me }) {
  const [posts, setPosts] = useState([]);
  const [err, setErr] = useState("");
  async function load() {
    setErr("");
    try { setPosts(await api.feed()); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold">Feed</div>
        <Button kind="ghost" onClick={load}>Refresh</Button>
      </div>
      {err ? <div className="text-sm text-red-400">{err}</div> : null}
      {posts.map(p => (
        <Card key={p.id}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">{p.trader_display_name || "Trader"} • {new Date(p.created_at).toLocaleString()}</div>
              <div className="text-lg font-bold">{p.title}</div>
            </div>
            <div className="text-xs px-2 py-1 rounded-lg border border-zinc-700 text-zinc-300">
              {p.type}{p.is_premium ? " • premium" : " • free"}
            </div>
          </div>
          <div className={`mt-3 text-sm leading-relaxed ${p.locked ? "text-zinc-400 italic" : "text-zinc-200"}`}>
            {p.content}
          </div>
          {p.cards?.length ? (
            <div className="mt-3 grid md:grid-cols-2 gap-2">
              {p.cards.map(c => (
                <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="text-sm font-semibold">Player: <span className="text-emerald-400">{c.player_id}</span> <span className="text-zinc-500">({c.platform})</span></div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Buy: {c.buy_price_min ?? "—"}–{c.buy_price_max ?? "—"} • Sell: {c.sell_price_min ?? "—"}–{c.sell_price_max ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function Traders() {
  const [traders, setTraders] = useState([]);
  const [err, setErr] = useState("");
  async function load() {
    setErr("");
    try { setTraders(await api.listTraders()); } catch (e) { setErr(e.message); }
  }
  useEffect(()=>{ load(); }, []);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold">Traders</div>
        <Button kind="ghost" onClick={load}>Refresh</Button>
      </div>
      {err ? <div className="text-sm text-red-400">{err}</div> : null}
      <div className="grid md:grid-cols-2 gap-3">
        {traders.map(t => (
          <Card key={t.user_id}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-xs text-zinc-400">
                {t.avatar_url ? <img alt="" src={t.avatar_url} className="w-full h-full object-cover"/> : "MX"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold">{t.display_name}</div>
                  {t.is_verified ? <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Verified</span> : null}
                </div>
                <div className="text-sm text-zinc-400 line-clamp-2">{t.bio || "—"}</div>
                <div className="mt-2 text-xs text-zinc-500">From £{(t.subscription_price_cents/100).toFixed(2)}/mo</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Studio({ me }) {
  const [profile, setProfile] = useState({ display_name: "", bio:"", banner_url:"", avatar_url:"", subscription_price_cents: 999 });
  const [post, setPost] = useState({ type:"trade", title:"", content:"", is_premium:true, cards: [] });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function saveProfile() {
    setErr(""); setOk("");
    try {
      await api.upsertProfile(profile);
      setOk("Profile saved.");
    } catch (e) { setErr(e.message); }
  }
  function addCard() {
    setPost(p => ({ ...p, cards: [...p.cards, { player_id:"", platform:"ps", buy_price_min:null, buy_price_max:null, sell_price_min:null, sell_price_max:null }] }));
  }
  function updateCard(i, key, val) {
    setPost(p => {
      const cards = p.cards.slice();
      cards[i] = { ...cards[i], [key]: val };
      return { ...p, cards };
    });
  }
  async function publish() {
    setErr(""); setOk("");
    try {
      await api.createPost(post);
      setOk("Post published.");
      setPost({ type:"trade", title:"", content:"", is_premium:true, cards: [] });
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="grid gap-4">
      <div className="text-xl font-extrabold">Trader Studio</div>
      {err ? <div className="text-sm text-red-400">{err}</div> : null}
      {ok ? <div className="text-sm text-emerald-400">{ok}</div> : null}

      <Card>
        <div className="font-bold mb-2">Profile</div>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Display name" value={profile.display_name} onChange={e=>setProfile({...profile, display_name:e.target.value})}/>
          <Input placeholder="Subscription price (cents)" value={profile.subscription_price_cents} onChange={e=>setProfile({...profile, subscription_price_cents: Number(e.target.value||0)})}/>
          <Input className="md:col-span-2" placeholder="Bio" value={profile.bio} onChange={e=>setProfile({...profile, bio:e.target.value})}/>
          <Input placeholder="Banner URL" value={profile.banner_url} onChange={e=>setProfile({...profile, banner_url:e.target.value})}/>
          <Input placeholder="Avatar URL" value={profile.avatar_url} onChange={e=>setProfile({...profile, avatar_url:e.target.value})}/>
        </div>
        <div className="mt-3">
          <Button onClick={saveProfile}>Save profile</Button>
        </div>
      </Card>

      <Card>
        <div className="font-bold mb-2">New post</div>
        <div className="grid gap-2">
          <div className="flex gap-2">
            <select className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-sm" value={post.type} onChange={e=>setPost({...post, type:e.target.value})}>
              <option value="trade">trade</option>
              <option value="sbc">sbc</option>
              <option value="prediction">prediction</option>
            </select>
            <select className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-sm" value={String(post.is_premium)} onChange={e=>setPost({...post, is_premium: e.target.value==="true"})}>
              <option value="true">premium</option>
              <option value="false">free</option>
            </select>
          </div>
          <Input placeholder="Title" value={post.title} onChange={e=>setPost({...post, title:e.target.value})}/>
          <textarea className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-sm outline-none focus:border-emerald-500 min-h-28"
            placeholder="Content" value={post.content} onChange={e=>setPost({...post, content:e.target.value})}/>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Attached cards</div>
            <Button kind="ghost" onClick={addCard}>+ Add card</Button>
          </div>
          {post.cards.map((c,i)=>(
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 grid md:grid-cols-3 gap-2">
              <Input placeholder="player_id (e.g. 12345 or name)" value={c.player_id} onChange={e=>updateCard(i,"player_id",e.target.value)} />
              <select className="rounded-xl bg-zinc-950 border border-zinc-800 p-2 text-sm" value={c.platform} onChange={e=>updateCard(i,"platform",e.target.value)}>
                <option value="ps">ps</option><option value="xbox">xbox</option><option value="pc">pc</option>
              </select>
              <div className="text-xs text-zinc-500 flex items-center">Ranges</div>
              <Input placeholder="buy min" value={c.buy_price_min ?? ""} onChange={e=>updateCard(i,"buy_price_min", e.target.value===""?null:Number(e.target.value))}/>
              <Input placeholder="buy max" value={c.buy_price_max ?? ""} onChange={e=>updateCard(i,"buy_price_max", e.target.value===""?null:Number(e.target.value))}/>
              <Input placeholder="sell min" value={c.sell_price_min ?? ""} onChange={e=>updateCard(i,"sell_price_min", e.target.value===""?null:Number(e.target.value))}/>
              <Input placeholder="sell max" value={c.sell_price_max ?? ""} onChange={e=>updateCard(i,"sell_price_max", e.target.value===""?null:Number(e.target.value))}/>
            </div>
          ))}
          <Button onClick={publish} disabled={!post.title || !post.content}>Publish</Button>
        </div>
      </Card>
    </div>
  );
}

function Settings({ me, refreshMe }) {
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function becomeTrader() {
    setErr(""); setOk("");
    try {
      await api.becomeTrader();
      await refreshMe();
      setOk("You're now a trader. Open Studio to create your profile + posts.");
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="grid gap-3">
      <div className="text-xl font-extrabold">Settings</div>
      {err ? <div className="text-sm text-red-400">{err}</div> : null}
      {ok ? <div className="text-sm text-emerald-400">{ok}</div> : null}
      <Card>
        <div className="font-bold">Account</div>
        <div className="mt-2 text-sm text-zinc-400">Role: <span className="text-zinc-200">{me?.role}</span></div>
        {me?.role === "user" ? (
          <div className="mt-3">
            <Button onClick={becomeTrader}>Become a trader</Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [view, setView] = useState("feed");
  const [err, setErr] = useState("");

  async function loadMe() {
    if (!getToken()) { setMe(null); return; }
    try { setMe(await api.me()); } catch { setMe(null); }
  }
  useEffect(()=>{ loadMe(); }, []);

  function logout() {
    clearToken();
    setMe(null);
    setView("feed");
  }

  if (!me) {
    return (
      <div className="min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-10">
          <div className="mb-6">
            <div className="text-3xl font-black tracking-tight"><span className="text-emerald-400">Market</span>XI</div>
            <div className="text-zinc-400 mt-1">Creator-led FC trading tips with subscriptions and tools.</div>
          </div>
          <Auth onAuthed={loadMe} />
          {err ? <div className="text-sm text-red-400 mt-3">{err}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar me={me} onLogout={logout} view={view} setView={setView} />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {view === "feed" ? <Feed me={me} /> : null}
        {view === "traders" ? <Traders /> : null}
        {view === "studio" ? <Studio me={me} /> : null}
        {view === "settings" ? <Settings me={me} refreshMe={loadMe} /> : null}
      </div>
    </div>
  );
}
