"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const photos = [
  { id: 1, title: "A quiet interval", name: "Mara Voss", category: "Street", description: "Late afternoon on Linienstraße.", image: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=86" },
  { id: 2, title: "Between tides", name: "Elias Nord", category: "Nature", description: "A shoreline held by weather.", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1400&q=86" },
  { id: 3, title: "Red room", name: "Iris Osei", category: "Portrait", description: "A study in a borrowed room.", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=86" }
];

export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState("gallery");
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const photo = photos.find((item) => item.id === selected);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAccountEmail(data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAccountEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return setMessage("Supabase is not configured yet.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in.");
    if (!error) setAuthOpen(false);
  }
  async function register() {
    if (!supabase) return setMessage("Supabase is not configured yet.");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Check your email to confirm your account.");
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); }
  const gallery = <section className="gallery">{photos.map((item) => <button key={item.id} className="photo" onClick={() => setSelected(item.id)}><img src={item.image} alt={item.title} /><span>{item.category}</span></button>)}</section>;
  const screen = view === "gallery" ? gallery : <section className="panel"><p className="eyebrow">{view}</p><h1>{view === "discover" ? "Discover slowly." : view === "upload" ? "Share a photograph." : view === "conversations" ? "Thoughtful exchanges." : "Mara Voss"}</h1><p>{view === "discover" ? "Varied work beyond your network. No popularity ranking." : "This prototype section is ready to connect to real data in Phase 2."}</p>{view === "discover" || view === "profile" ? gallery : null}</section>;
  return <main className="shell"><header><button className="wordmark" onClick={() => { setSelected(null); setView("gallery"); }}>STILL.</button><nav>{["gallery","discover","upload","conversations","profile"].map((item) => <button className={view === item ? "active" : ""} key={item} onClick={() => { setSelected(null); setView(item); }}>{item}</button>)}{accountEmail ? <button onClick={signOut}>Sign out</button> : <button onClick={() => setAuthOpen(true)}>Sign in</button>}</nav></header>{authOpen && <section className="auth"><button className="back" onClick={() => setAuthOpen(false)}>× Close</button><h1>Welcome to STILL.</h1><form onSubmit={authenticate}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={8} required /><button type="submit">Sign in</button><button type="button" onClick={register}>Create account</button></form><p>{message}</p></section>}{photo ? <section className="detail"><button className="back" onClick={() => setSelected(null)}>← Back</button><img src={photo.image} alt={photo.title} /><div><p className="eyebrow">{photo.category}</p><h1>{photo.title}</h1><p>{photo.description}</p><p>Photograph by {photo.name}</p></div></section> : screen}</main>;
}
