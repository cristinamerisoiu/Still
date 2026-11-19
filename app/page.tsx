"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const photos = [
  { id: 1, title: "A quiet interval", name: "Mara Voss", category: "Street", description: "Late afternoon on Linienstraße.", image: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=86" },
  { id: 2, title: "Between tides", name: "Elias Nord", category: "Nature", description: "A shoreline held by weather.", image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1400&q=86" },
  { id: 3, title: "Red room", name: "Iris Osei", category: "Portrait", description: "A study in a borrowed room.", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=86" }
];
type StoredPhoto = { id: string; title: string | null; categories: string[]; image_path: string; status: "draft" | "published" };
type PublishedPhoto = StoredPhoto & { owner_id: string; profiles: { display_name: string; handle: string } | null };
type PhotographDetail = PublishedPhoto & { description: string | null; comments_enabled: boolean };
type PhotographComment = { id: string; body: string; author_id: string; created_at: string; profiles: { display_name: string; handle: string } | null };

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userPhotos, setUserPhotos] = useState<StoredPhoto[]>([]);
  const [publishedPhotos, setPublishedPhotos] = useState<PublishedPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotographDetail | null>(null);
  const [comments, setComments] = useState<PhotographComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [appreciated, setAppreciated] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const photo = photos.find((item) => item.id === selected);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => syncSession(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session?.user.id ?? null, session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { void loadPublishedPhotos(); }, []);
  useEffect(() => {
    if (view === "profile" && userId) void loadUserPhotos(userId);
  }, [view, userId]);
  async function syncSession(id: string | null, userEmail: string | null) {
    setUserId(id); setAccountEmail(userEmail);
    if (!id || !supabase) { setNeedsProfile(false); setUserPhotos([]); setBookmarked(new Set()); setAppreciated(new Set()); setFollowed(new Set()); return; }
    const { data } = await supabase.from("profiles").select("display_name, handle, bio, location, website").eq("id", id).maybeSingle();
    setProfile(data); setNeedsProfile(!data);
    await Promise.all([loadUserPhotos(id), loadPersonalActions(id), loadFollows(id)]);
  }
  async function loadUserPhotos(id: string) {
    if (!supabase) return;
    const { data } = await supabase.from("photographs").select("id, title, categories, image_path, status").eq("owner_id", id).order("created_at", { ascending: false });
    setUserPhotos(data ?? []);
  }
  async function loadPublishedPhotos() {
    if (!supabase) return;
    const { data } = await supabase.from("photographs").select("id, title, categories, image_path, owner_id, profiles(display_name, handle)").eq("status", "published").order("published_at", { ascending: false });
    setPublishedPhotos((data as PublishedPhoto[] | null) ?? []);
  }
  async function loadPersonalActions(id: string) {
    if (!supabase) return;
    const [{ data: bookmarks }, { data: appreciations }] = await Promise.all([
      supabase.from("bookmarks").select("photograph_id").eq("user_id", id),
      supabase.from("appreciations").select("photograph_id").eq("user_id", id)
    ]);
    setBookmarked(new Set((bookmarks ?? []).map((item) => item.photograph_id)));
    setAppreciated(new Set((appreciations ?? []).map((item) => item.photograph_id)));
  }
  async function loadFollows(id: string) {
    if (!supabase) return;
    const { data } = await supabase.from("follows").select("followed_id").eq("follower_id", id);
    setFollowed(new Set((data ?? []).map((item) => item.followed_id)));
  }
  async function openPhotograph(id: string) {
    if (!supabase) return;
    const [{ data: photograph }, { data: photographComments }] = await Promise.all([
      supabase.from("photographs").select("id, title, categories, image_path, status, owner_id, description, comments_enabled, profiles(display_name, handle)").eq("id", id).maybeSingle(),
      supabase.from("comments").select("id, body, author_id, created_at, profiles(display_name, handle)").eq("photograph_id", id).order("created_at", { ascending: true })
    ]);
    if (!photograph) return setMessage("This photograph is no longer available.");
    setSelectedPhoto(photograph as unknown as PhotographDetail);
    setComments((photographComments as PhotographComment[] | null) ?? []);
    setView("photograph");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId || !selectedPhoto) return setAuthOpen(true);
    const body = commentBody.trim();
    if (!body) return;
    const { error } = await supabase.from("comments").insert({ photograph_id: selectedPhoto.id, author_id: userId, body });
    if (error) return setMessage(error.message);
    setCommentBody("");
    await openPhotograph(selectedPhoto.id);
  }
  async function toggleAction(table: "bookmarks" | "appreciations", photoId: string) {
    if (!supabase || !userId) return setAuthOpen(true);
    const active = table === "bookmarks" ? bookmarked.has(photoId) : appreciated.has(photoId);
    const { error } = active ? await supabase.from(table).delete().eq("user_id", userId).eq("photograph_id", photoId) : await supabase.from(table).insert({ user_id: userId, photograph_id: photoId });
    if (error) return setMessage(error.message);
    await loadPersonalActions(userId);
  }
  async function toggleFollow(profileId: string) {
    if (!supabase || !userId) return setAuthOpen(true);
    if (profileId === userId) return;
    const isFollowing = followed.has(profileId);
    const { error } = isFollowing ? await supabase.from("follows").delete().eq("follower_id", userId).eq("followed_id", profileId) : await supabase.from("follows").insert({ follower_id: userId, followed_id: profileId });
    if (error) return setMessage(error.message);
    await loadFollows(userId);
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
    await Promise.all([loadUserPhotos(userId), loadPublishedPhotos()]); setUploadFile(null); setPreviewUrl(null); setPhotoTitle(""); setPhotoDescription(""); setPhotoCategories(""); setMessage("Photograph saved."); setView("profile");
  }
  async function setPhotographStatus(photo: StoredPhoto, publish: boolean) {
    if (!supabase || !userId) return;
    const { error } = await supabase.from("photographs").update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null }).eq("id", photo.id);
    setMessage(error ? error.message : publish ? "Photograph published." : "Moved to drafts.");
    if (!error) await Promise.all([loadUserPhotos(userId), loadPublishedPhotos()]);
  }
  async function deletePhotograph(photo: StoredPhoto) {
    if (!supabase || !userId || !window.confirm("Delete this photograph permanently?")) return;
    const { error } = await supabase.from("photographs").delete().eq("id", photo.id);
    if (!error) await supabase.storage.from("photographs").remove([photo.image_path]);
    setMessage(error ? error.message : "Photograph deleted.");
    if (!error) await Promise.all([loadUserPhotos(userId), loadPublishedPhotos()]);
  }
  const gallery = <section className="gallery">{publishedPhotos.length ? publishedPhotos.map((item) => { const { data } = supabase?.storage.from("photographs").getPublicUrl(item.image_path) ?? { data: { publicUrl: "" } }; return <article key={item.id} className="photo" onClick={() => openPhotograph(item.id)}><img src={data.publicUrl} alt={item.title ?? "Published photograph"} /><span>{item.categories[0] ?? "Photograph"}</span>{userId && <div className="photo-tools" onClick={(event) => event.stopPropagation()}><button onClick={() => toggleAction("bookmarks", item.id)}>{bookmarked.has(item.id) ? "Bookmarked" : "Bookmark"}</button><button onClick={() => toggleAction("appreciations", item.id)}>{appreciated.has(item.id) ? "Appreciated" : "Appreciate"}</button></div>}</article>; }) : <p className="empty-gallery">No published photographs yet.</p>}</section>;
  const uploadScreen = <section className="upload"><div className="upload-heading"><p className="eyebrow">New photograph</p><h1>Share a photograph.</h1><p>Let the work take up space.</p></div>{userId ? <form onSubmit={uploadPhotograph}><label className={`dropzone ${previewUrl ? 'has-preview' : ''}`}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] ?? null; setUploadFile(file); setPreviewUrl(file ? URL.createObjectURL(file) : null); }} required />{previewUrl ? <><img src={previewUrl} alt="Selected photograph preview" /><span>Choose another photograph</span></> : <><strong>Choose a photograph</strong><span>JPEG, PNG, or WebP · 15 MB maximum</span></>}</label><div className="upload-fields"><input value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} placeholder="Untitled (optional)" maxLength={140} /><textarea value={photoDescription} onChange={(e) => setPhotoDescription(e.target.value)} placeholder="A few words, if you want" maxLength={1200} /><input value={photoCategories} onChange={(e) => setPhotoCategories(e.target.value)} placeholder="Categories · up to three, separated by commas" /><div className="upload-options"><label><input type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} /> Conversations welcome</label><label><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /> Publish now</label></div><button className="publish" type="submit" disabled={uploading}>{uploading ? 'Saving…' : publishNow ? 'Publish photograph' : 'Save as draft'}</button></div></form> : <p>Sign in to upload photographs.</p>}<p className="upload-message">{message}</p></section>;
  const profileGallery = <section className="gallery">{userPhotos.map((item) => { const { data } = supabase?.storage.from("photographs").getPublicUrl(item.image_path) ?? { data: { publicUrl: "" } }; return <article key={item.id} className="photo managed-photo"><img src={data.publicUrl} alt={item.title ?? "Photograph"} /><span>{item.status === "draft" ? "Draft" : item.categories[0] ?? "Photograph"}</span><div className="photo-tools"><button onClick={() => setPhotographStatus(item, item.status === "draft")}>{item.status === "draft" ? "Publish" : "Unpublish"}</button><button onClick={() => deletePhotograph(item)}>Delete</button></div></article>; })}</section>;
  const photographScreen = selectedPhoto ? (() => { const { data } = supabase?.storage.from("photographs").getPublicUrl(selectedPhoto.image_path) ?? { data: { publicUrl: "" } }; return <section className="detail"><button className="back" onClick={() => { setSelectedPhoto(null); setView("gallery"); }}>← Back to gallery</button><img src={data.publicUrl} alt={selectedPhoto.title ?? "Photograph"} /><div className="detail-copy"><p className="eyebrow">{selectedPhoto.categories.join(" · ") || "Photograph"}</p><h1>{selectedPhoto.title || "Untitled"}</h1>{selectedPhoto.description && <p>{selectedPhoto.description}</p>}<p>Photograph by {selectedPhoto.profiles?.display_name ?? "Unknown photographer"} · @{selectedPhoto.profiles?.handle ?? ""}</p>{userId && <div className="detail-actions">{selectedPhoto.owner_id !== userId && <button onClick={() => toggleFollow(selectedPhoto.owner_id)}>{followed.has(selectedPhoto.owner_id) ? "Following" : "Follow"}</button>}<button onClick={() => toggleAction("bookmarks", selectedPhoto.id)}>{bookmarked.has(selectedPhoto.id) ? "Bookmarked" : "Bookmark"}</button><button onClick={() => toggleAction("appreciations", selectedPhoto.id)}>{appreciated.has(selectedPhoto.id) ? "Appreciated" : "Appreciate"}</button></div>}</div><section className="comments"><p className="eyebrow">Conversation</p>{selectedPhoto.comments_enabled ? <>{comments.length ? comments.map((comment) => <article key={comment.id} className="comment"><strong>{comment.profiles?.display_name ?? "Photographer"}</strong><span>@{comment.profiles?.handle ?? ""}</span><p>{comment.body}</p></article>) : <p className="muted">No comments yet.</p>}{userId ? <form onSubmit={addComment}><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave a thoughtful note" maxLength={2000} required /><button type="submit">Post comment</button></form> : <button onClick={() => setAuthOpen(true)}>Sign in to comment</button>}</> : <p className="muted">Comments are closed for this photograph.</p>}</section></section>; })() : null;
  const screen = view === "gallery" ? gallery : view === "photograph" ? photographScreen : view === "profile" ? <section className="panel"><p className="eyebrow">Photographer profile</p><h1>{profile?.display_name ?? "Your profile"}</h1><p>@{profile?.handle ?? ""}{profile?.location ? ` · ${profile.location}` : ""}</p><p>{profile?.bio || "No biography yet."}</p>{profile?.website && <p>{profile.website}</p>}<button className="edit" onClick={openProfileEditor}>Edit profile</button><p className="eyebrow">Your photographs</p>{userPhotos.length ? profileGallery : <p>Published photographs will appear here.</p>}</section> : view === "upload" ? uploadScreen : <section className="panel"><p className="eyebrow">{view}</p><h1>{view === "discover" ? "Discover slowly." : "Thoughtful exchanges."}</h1><p>{view === "discover" ? "Varied work beyond your network. No popularity ranking." : "This space will show your notifications and conversations."}</p>{view === "discover" ? gallery : null}</section>;
  return <main className="shell"><header><button className="wordmark" onClick={() => { setSelected(null); setView("gallery"); }}>STILL.</button><nav>{["gallery","discover","upload","conversations","profile"].map((item) => <button className={view === item ? "active" : ""} key={item} onClick={() => { setSelected(null); setView(item); }}>{item}</button>)}{accountEmail ? <button onClick={signOut}>Sign out</button> : <button onClick={() => setAuthOpen(true)}>Sign in</button>}</nav></header>{editingProfile && <section className="auth"><button className="back" onClick={() => setEditingProfile(false)}>× Close</button><h1>Edit profile</h1><form onSubmit={saveProfile}><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required /><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" pattern="[a-zA-Z0-9_]{3,30}" required /><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Biography" maxLength={500} /><input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Location" maxLength={120} /><input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="Website" maxLength={240} /><button type="submit">Save profile</button></form><p>{message}</p></section>}{needsProfile && <section className="auth"><h1>Set up your profile.</h1><form onSubmit={createProfile}><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required /><input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle (letters, numbers, underscore)" pattern="[a-zA-Z0-9_]{3,30}" required /><button type="submit">Create profile</button></form><p>{message}</p></section>}{authOpen && <section className="auth"><button className="back" onClick={() => setAuthOpen(false)}>× Close</button><h1>Welcome to STILL.</h1><form onSubmit={authenticate}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={8} required /><button type="submit">Sign in</button><button type="button" onClick={register}>Create account</button></form><p>{message}</p></section>}{photo ? <section className="detail"><button className="back" onClick={() => setSelected(null)}>← Back</button><img src={photo.image} alt={photo.title} /><div><p className="eyebrow">{photo.category}</p><h1>{photo.title}</h1><p>{photo.description}</p><p>Photograph by {photo.name}</p></div></section> : screen}</main>;
}
