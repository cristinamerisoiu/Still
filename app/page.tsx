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
  const [userId, setUserId] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<{ display_name: string; handle: string; bio: string | null; location: string | null; website: string | null } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [photoTitle, setPhotoTitle] = useState("");
  const [photoDescription, setPhotoDescription] = useState("");
  const [photoCategories, setPhotoCategories] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [publishNow, setPublishNow] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const photo = photos.find((item) => item.id === selected);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => syncSession(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session?.user.id ?? null, session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  async function syncSession(id: string | null, userEmail: string | null) {
    setUserId(id); setAccountEmail(userEmail);
    if (!id || !supabase) return setNeedsProfile(false);
    const { data } = await supabase.from("profiles").select("display_name, handle, bio, location, website").eq("id", id).maybeSingle();
    setProfile(data); setNeedsProfile(!data);
  }
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
  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    const normalizedHandle = handle.trim().toLowerCase();
    const { error } = await supabase.from("profiles").insert({ id: userId, handle: normalizedHandle, display_name: displayName.trim() });
    setMessage(error ? error.message : "Your photographer profile is ready.");
    if (!error) { setNeedsProfile(false); await syncSession(userId, accountEmail); }
  }
  function openProfileEditor() {
    setDisplayName(profile?.display_name ?? ""); setHandle(profile?.handle ?? ""); setEditBio(profile?.bio ?? ""); setEditLocation(profile?.location ?? ""); setEditWebsite(profile?.website ?? ""); setEditingProfile(true);
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim(), handle: handle.trim().toLowerCase(), bio: editBio.trim() || null, location: editLocation.trim() || null, website: editWebsite.trim() || null }).eq("id", userId);
    setMessage(error ? error.message : "Profile saved.");
    if (!error) { setEditingProfile(false); await syncSession(userId, accountEmail); }
  }
  async function uploadPhotograph(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId || !uploadFile) return setMessage("Choose a photograph first.");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(uploadFile.type)) return setMessage("Use a JPEG, PNG, or WebP image.");
    if (uploadFile.size > 15 * 1024 * 1024) return setMessage("Images must be 15 MB or smaller.");
    const categories = photoCategories.split(',').map((item) => item.trim()).filter(Boolean);
    if (categories.length > 3) return setMessage("Choose up to three categories.");
    setUploading(true); setMessage("");
    const extension = uploadFile.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: storageError } = await supabase.storage.from('photographs').upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
    if (storageError) { setUploading(false); return setMessage(storageError.message); }
    const { error } = await supabase.from('photographs').insert({ owner_id: userId, image_path: path, title: photoTitle.trim() || null, description: photoDescription.trim() || null, categories, comments_enabled: commentsEnabled, status: publishNow ? 'published' : 'draft', published_at: publishNow ? new Date().toISOString() : null });
    setUploading(false);
    if (error) return setMessage(error.message);
    setUploadFile(null); setPhotoTitle(""); setPhotoDescription(""); setPhotoCategories(""); setMessage("Photograph saved.");
  }
  const gallery = <section className="gallery">{photos.map((item) => <button key={item.id} className="photo" onClick={() => setSelected(item.id)}><img src={item.image} alt={item.title} /><span>{item.category}</span></button>)}</section>;
  const uploadScreen = <section className="auth"><h1>Share a photograph.</h1>{userId ? <form onSubmit={uploadPhotograph}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} required /><input value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} placeholder="Title (optional)" maxLength={140} /><textarea value={photoDescription} onChange={(e) => setPhotoDescription(e.target.value)} placeholder="Description (optional)" maxLength={1200} /><input value={photoCategories} onChange={(e) => setPhotoCategories(e.target.value)} placeholder="Categories, separated by commas (up to 3)" /><label><input type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} /> Allow comments</label><label><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /> Publish now</label><button type="submit" disabled={uploading}>{uploading ? 'Saving…' : publishNow ? 'Publish photograph' : 'Save draft'}</button></form> : <p>Sign in to upload photographs.</p>}<p>{message}</p></section>;
  const screen = view === "gallery" ? gallery : view === "profile" ? <section className="panel"><p className="eyebrow">Photographer profile</p><h1>{profile?.display_name ?? "Your profile"}</h1><p>@{profile?.handle ?? ""}{profile?.location ? ` · ${profile.location}` : ""}</p><p>{profile?.bio || "No biography yet."}</p>{profile?.website && <p>{profile.website}</p>}<button className="edit" onClick={openProfileEditor}>Edit profile</button><p className="eyebrow">Selected photographs</p>{gallery}</section> : view === "upload" ? uploadScreen : <section className="panel"><p className="eyebrow">{view}</p><h1>{view === "discover" ? "Discover slowly." : "Thoughtful exchanges."}</h1><p>{view === "discover" ? "Varied work beyond your network. No popularity ranking." : "This section is ready to connect to real data in Phase 2."}</p>{view === "discover" ? gallery : null}</section>;
  return <main className="shell"><header><button className="wordmark" onClick={() => { setSelected(null); setView("gallery"); }}>STILL.</button><nav>{["gallery","discover","upload","conversations","profile"].map((item) => <button className={view === item ? "active" : ""} key={item} onClick={() => { setSelected(null); setView(item); }}>{item}</button>)}{accountEmail ? <button onClick={signOut}>Sign out</button> : <button onClick={() => setAuthOpen(true)}>Sign in</button>}</nav></header>{editingProfile && <section className="auth"><button className="back" onClick={() => setEditingProfile(false)}>× Close</button><h1>Edit profile</h1><form onSubmit={saveProfile}><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required /><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" pattern="[a-zA-Z0-9_]{3,30}" required /><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Biography" maxLength={500} /><input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Location" maxLength={120} /><input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="Website" maxLength={240} /><button type="submit">Save profile</button></form><p>{message}</p></section>}{needsProfile && <section className="auth"><h1>Set up your profile.</h1><form onSubmit={createProfile}><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required /><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle (letters, numbers, underscore)" pattern="[a-zA-Z0-9_]{3,30}" required /><button type="submit">Create profile</button></form><p>{message}</p></section>}{authOpen && <section className="auth"><button className="back" onClick={() => setAuthOpen(false)}>× Close</button><h1>Welcome to STILL.</h1><form onSubmit={authenticate}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={8} required /><button type="submit">Sign in</button><button type="button" onClick={register}>Create account</button></form><p>{message}</p></section>}{photo ? <section className="detail"><button className="back" onClick={() => setSelected(null)}>← Back</button><img src={photo.image} alt={photo.title} /><div><p className="eyebrow">{photo.category}</p><h1>{photo.title}</h1><p>{photo.description}</p><p>Photograph by {photo.name}</p></div></section> : screen}</main>;
}
