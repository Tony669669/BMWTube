// Only these application preferences belong in a portable backup. Never enumerate storage.
export const DEFAULTS = {
  recent: [], searches: [], favoriteVideos: [], watchLater: [], continueWatching: [],
  favoriteChannels: [], playlists: [], telex: false, playerSide: 'left', repeatVideo: false,
  homeDefault: 'favorites', libraryDefault: 'favorite-channels', appProfile: 'red', audioOnlyDefault: false,
};
export const PREFIX = 'bmwtube.';
export const MAX_BYTES = 900 * 1024;
export const REPO = 'Tony669669/BMWTube';
export const BRANCH = 'bmwtube-backups';
const UNDO = PREFIX + 'backup.undo';
const BASE = PREFIX + 'backup.base';
const fail = () => { throw Error('Bản sao không hợp lệ hoặc vượt giới hạn dữ liệu.'); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const str = (value, max = 2000) => { if(typeof value !== 'string' || value.length > max) fail(); return value; };
function array(value, max, parse) {
  if(!Array.isArray(value) || value.length > max) fail();
  return value.map(parse);
}
function video(value) {
  if(!object(value) || typeof value.id !== 'string' || !/^[\w-]{11}$/.test(value.id)) fail();
  const result = {id: value.id, title: str(value.title)};
  for(const name of ['channel', 'channelId', 'publishedAt']) if(value[name] !== undefined) result[name] = str(value[name]);
  for(const name of ['position', 'duration', 'updatedAt']) if(value[name] !== undefined) {
    if(typeof value[name] !== 'number' || !Number.isFinite(value[name]) || value[name] < 0) fail();
    result[name] = value[name];
  }
  return result;
}
export function validateData(data) {
  if(!object(data)) fail();
  const result = {};
  for(const name of Object.keys(DEFAULTS)) {
    const value = data[name];
    if(value === undefined) fail();
    if(['recent', 'continueWatching', 'favoriteVideos', 'watchLater'].includes(name)) {
      result[name] = array(value, ['recent', 'continueWatching'].includes(name) ? 20 : 100, video);
    } else if(name === 'searches') result[name] = array(value, 8, v => str(v));
    else if(name === 'favoriteChannels') result[name] = array(value, 100, v => {
      if(!object(v) || typeof v.id !== 'string' || !/^UC[\w-]{22}$/.test(v.id)) fail();
      const channel = {id: v.id, title: str(v.title)};
      if(v.thumbnail !== undefined) channel.thumbnail = str(v.thumbnail);
      return channel;
    });
    else if(name === 'playlists') {
      const ids = new Set();
      result[name] = array(value, 100, v => {
        if(!object(v)) fail();
        const id = str(v.id, 200);
        if(!id || ids.has(id)) fail();
        ids.add(id);
        return {id, name: str(v.name), videos: array(v.videos, 500, video)};
      });
    } else if(typeof DEFAULTS[name] === 'boolean') {
      if(typeof value !== 'boolean') fail();
      result[name] = value;
    } else {
      const choices = {playerSide: ['left', 'right'], homeDefault: ['favorites', 'explore'],
        libraryDefault: ['watch-later', 'favorite-channels', 'playlists'], appProfile: ['red', 'yellow']};
      if(!choices[name].includes(value)) fail();
      result[name] = value;
    }
  }
  return result;
}
export function readData(storage) {
  const data = {};
  for(const [name, fallback] of Object.entries(DEFAULTS)) {
    const raw = storage.getItem(PREFIX + name);
    try { data[name] = raw === null ? fallback : JSON.parse(raw); }
    catch { throw Error('Dữ liệu trên thiết bị bị lỗi. Chưa tạo bản sao lưu.'); }
  }
  return validateData(data);
}
export function makeBackup(storage) {
  const backup = {app: 'BMWTube', version: 1, createdAt: new Date().toISOString(), data: readData(storage)};
  if(new TextEncoder().encode(JSON.stringify(backup)).length > MAX_BYTES) fail();
  return backup;
}
export function parseBackup(text) {
  if(typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) fail();
  let value; try { value = JSON.parse(text); } catch { fail(); }
  if(!object(value) || value.app !== 'BMWTube' || value.version !== 1 ||
     typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) fail();
  return {app: 'BMWTube', version: 1, createdAt: value.createdAt, data: validateData(value.data)};
}
export function hasLocalData(storage) {
  return Object.keys(DEFAULTS).some(name => storage.getItem(PREFIX + name) !== null);
}
export function readBase(storage) {
  try { return JSON.parse(storage.getItem(BASE)); } catch { return null; }
}
export function saveBase(storage, sha, data, createdAt) {
  storage.setItem(BASE, JSON.stringify({sha, data: validateData(data), createdAt}));
}
function rawSnapshot(storage) {
  return Object.fromEntries([...Object.keys(DEFAULTS).map(k => PREFIX + k), BASE].map(k => [k, storage.getItem(k)]));
}
function writeRaw(storage, snapshot) {
  for(const [key, value] of Object.entries(snapshot)) {
    if(value === null) storage.removeItem(key); else storage.setItem(key, value);
  }
}
// Keep a complete local undo before changing any preferences; roll back partial writes on error.
export function restoreBackup(storage, backup, sha) {
  const data = validateData(backup.data), before = rawSnapshot(storage), oldUndo = storage.getItem(UNDO);
  try {
    storage.setItem(UNDO, JSON.stringify(before));
    for(const [name, value] of Object.entries(data)) storage.setItem(PREFIX + name, JSON.stringify(value));
    saveBase(storage, sha, data, backup.createdAt);
  } catch {
    try { storage.removeItem(UNDO); writeRaw(storage, before); if(oldUndo === null) storage.removeItem(UNDO); else storage.setItem(UNDO, oldUndo); } catch {}
    throw Error('Không đủ bộ nhớ hoặc trình duyệt không cho lưu. Chưa khôi phục thành công.');
  }
}
export function hasUndo(storage) { return storage.getItem(UNDO) !== null; }
export function undoRestore(storage) {
  const raw = storage.getItem(UNDO);
  if(!raw) throw Error('Không có lần khôi phục để hoàn tác.');
  let saved; try { saved = JSON.parse(raw); } catch { fail(); }
  const before = rawSnapshot(storage);
  if(!object(saved) || Object.keys(saved).length !== Object.keys(before).length) fail();
  for(const name of Object.keys(before)) if(!(name in saved) || (saved[name] !== null && typeof saved[name] !== 'string')) fail();
  try { writeRaw(storage, saved); storage.removeItem(UNDO); }
  catch { try { writeRaw(storage, before); } catch {} throw Error('Không thể lưu dữ liệu hoàn tác.'); }
}
export function encodeContent(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = ''; for(let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export class GitHubBackup {
  constructor(fetcher = (...args) => fetch(...args)) { this.fetcher = fetcher; }
  async request(path, {token = '', method = 'GET', body, missing = false} = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = {Accept: 'application/vnd.github+json'};
      if(token) headers.Authorization = `Bearer ${token}`;
      if(body) headers['Content-Type'] = 'application/json';
      const response = await this.fetcher(`https://api.github.com/repos/${REPO}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
      if(response.status === 404 && missing) return null;
      if(!response.ok) {
        if(response.status === 401) throw Error('Token sai hoặc đã hết hạn. Hãy nhập token mới.');
        if(response.status === 403 || response.status === 429) throw Error('GitHub từ chối truy cập: kiểm tra quyền Contents hoặc thử lại khi hết giới hạn truy cập.');
        if(response.status === 409 || response.status === 422) throw Error('Bản GitHub đã thay đổi hoặc nhánh bị hạn chế. Kiểm tra lại trước khi lưu.');
        if(response.status === 404) throw Error('Không tìm thấy repo hoặc token không có quyền truy cập.');
        throw Error('GitHub tạm thời không phản hồi. Hãy thử lại.');
      }
      return await response.json();
    } catch(error) {
      if(error.name === 'AbortError' || error instanceof TypeError) throw Error('Không kết nối được GitHub. Kiểm tra mạng và thử lại.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async read(token = '') {
    const file = await this.request(`/contents/backup.json?ref=${BRANCH}`, {token, missing: true});
    if(!file) return null;
    if(file.type !== 'file' || file.encoding !== 'base64' || file.size > MAX_BYTES || typeof file.content !== 'string' || typeof file.sha !== 'string') fail();
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))); } catch { fail(); }
    return {sha: file.sha, backup: parseBackup(text)};
  }
  async ensureBranch(token) {
    const branch = await this.request(`/git/ref/heads/${BRANCH}`, {token, missing: true});
    if(branch) return;
    const main = await this.request('/git/ref/heads/main', {token});
    try { await this.request('/git/refs', {token, method: 'POST', body: {ref: `refs/heads/${BRANCH}`, sha: main.object.sha}}); }
    catch(error) { if(!await this.request(`/git/ref/heads/${BRANCH}`, {token, missing: true})) throw error; }
  }
  async write(backup, token, expectedSha) {
    if(!token.trim()) throw Error('Nhập GitHub token để lưu bản sao.');
    const clean = parseBackup(JSON.stringify(backup));
    const latest = await this.read(token);
    if((latest?.sha || null) !== expectedSha) {
      const error = Error('Bản GitHub khác phiên bản trên thiết bị. Xem bản sao trước khi chọn thay thế.');
      error.conflict = true; error.latest = latest; throw error;
    }
    await this.ensureBranch(token);
    const response = await this.request('/contents/backup.json', {token, method: 'PUT', body: {
      message: 'Backup BMWTube preferences and library', branch: BRANCH,
      content: encodeContent(JSON.stringify(clean)), ...(expectedSha ? {sha: expectedSha} : {}),
    }});
    return response.content.sha;
  }
}
