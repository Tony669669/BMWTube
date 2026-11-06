import {GitHubBackup, makeBackup, readData, readBase, saveBase, hasLocalData, restoreBackup, hasUndo, undoRestore, PREFIX} from './backup.js?v=github-backup-1';

export function initBackup({beforeApply, applyFailed, openSettings}) {
  const $ = id => document.getElementById(id), api = new GitHubBackup();
  const tokenKey = PREFIX + 'backup.token';
  let store, remote = null, busy = false, replaceSha, undoArmed = false, operation = 0;
  const status = message => { $('backup-status').textContent = message; };
  try {
    store = window.localStorage;
    $('backup-token').value = store.getItem(tokenKey) || '';
    $('backup-remember').checked = Boolean($('backup-token').value);
  } catch { status('Trình duyệt không cho truy cập bộ nhớ. Không thể sao lưu/khôi phục.'); return; }
  function updateLocal() {
    try {
      const base = readBase(store), data = readData(store);
      $('backup-local').textContent = !base ? 'Chưa sao lưu từ trình duyệt này.' :
        JSON.stringify(base.data) === JSON.stringify(data) ? `Dữ liệu khớp bản sao ${new Date(base.createdAt).toLocaleString('vi-VN')}.` : 'Có thay đổi chưa sao lưu.';
      $('backup-undo').hidden = !hasUndo(store);
    } catch(error) { $('backup-local').textContent = error.message; }
  }
  function preview() {
    $('backup-preview').hidden = !remote;
    $('backup-confirm').hidden = true;
    $('backup-replace').hidden = true;
    replaceSha = undefined;
    if(!remote) return;
    const {data, createdAt} = remote.backup;
    $('backup-summary').textContent = `${new Date(createdAt).toLocaleString('vi-VN')} · ${data.playlists.length} playlist (${data.playlists.reduce((n, p) => n + p.videos.length, 0)} video) · ${data.favoriteVideos.length} video yêu thích · ${data.favoriteChannels.length} kênh · ${data.watchLater.length} xem sau · ${data.recent.length} video gần đây · ${data.searches.length} tìm kiếm · ${data.continueWatching.length} đang xem.`;
  }
  async function run(action) {
    if(busy) return;
    busy = true; operation++; $('backup-section').setAttribute('aria-busy', 'true');
    const controls = [...$('backup-section').querySelectorAll('button, input')];
    controls.forEach(el => el.disabled = true);
    try { await action(); }
    catch(error) { status(error.message); }
    finally { busy = false; controls.forEach(el => el.disabled = false); $('backup-section').removeAttribute('aria-busy'); updateLocal(); }
  }
  function remember() {
    if($('backup-remember').checked) store.setItem(tokenKey, $('backup-token').value.trim());
    else store.removeItem(tokenKey);
  }
  $('backup-remember').onchange = () => { try { remember(); } catch { status('Không lưu được token trên thiết bị.'); } };
  $('backup-token').onchange = () => { try { remember(); } catch { status('Không lưu được token trên thiết bị.'); } };
  $('backup-forget').onclick = () => {
    try { store.removeItem(tokenKey); $('backup-token').value = ''; $('backup-remember').checked = false; status('Đã quên token trên trình duyệt này.'); }
    catch { status('Không thể xóa token khỏi bộ nhớ.'); }
  };
  async function check() {
    status('Đang kiểm tra GitHub…');
    remote = null; preview();
    remote = await api.read($('backup-token').value.trim()); preview();
    status(remote ? 'Đã tìm thấy bản sao lưu. Xem thông tin trước khi khôi phục.' : 'Chưa tìm thấy bản sao công khai, hoặc repo riêng tư cần token.');
  }
  $('backup-check').onclick = () => run(check);
  async function save(expectedSha) {
    status('Đang lưu lên GitHub…');
    const token = $('backup-token').value.trim();
    remember();
    const backup = makeBackup(store);
    try {
      const sha = await api.write(backup, token, expectedSha);
      remote = {sha, backup}; preview();
      try { saveBase(store, sha, backup.data, backup.createdAt); }
      catch { status('Đã lưu trên GitHub, nhưng không lưu được trạng thái trên thiết bị.'); return; }
      status('Đã sao lưu thành công lên GitHub.');
    } catch(error) {
      if(error.conflict) {
        remote = error.latest; preview(); replaceSha = remote?.sha || null;
        $('backup-replace').hidden = false;
      }
      throw error;
    }
  }
  $('backup-save').onclick = () => run(() => save(readBase(store)?.sha || null));
  $('backup-replace').onclick = () => { if(replaceSha !== undefined) { const sha = replaceSha; run(() => save(sha)); } };
  $('backup-restore').onclick = () => {
    $('backup-confirm').hidden = false;
    $('backup-confirm-text').textContent = hasLocalData(store) ?
      'Thay thế thư viện và cài đặt hiện tại bằng bản sao này? API key/token được giữ nguyên. Có thể hoàn tác lần khôi phục gần nhất.' :
      'Khôi phục bản sao này vào trình duyệt? API key/token hiện có được giữ nguyên.';
  };
  $('backup-cancel').onclick = () => { $('backup-confirm').hidden = true; };
  function reloadAfter(action) {
    beforeApply();
    try { action(); }
    catch(error) { applyFailed(); throw error; }
    // Do not replay a video from the previous library while reloading the restored state.
    const url = new URL(location.href); url.searchParams.delete('v'); url.searchParams.delete('t');
    url.hash = 'backup-restored'; window.history.replaceState(null, '', url); location.reload();
  }
  $('backup-confirm-restore').onclick = () => run(async () => {
    if(!remote) throw Error('Hãy kiểm tra bản sao trước khi khôi phục.');
    reloadAfter(() => restoreBackup(store, remote.backup, remote.sha));
  });
  $('backup-undo').onclick = () => {
    if(!undoArmed) {
      undoArmed = true; $('backup-undo-confirm').hidden = false;
      status('Hoàn tác sẽ thay thế dữ liệu hiện tại bằng dữ liệu ngay trước lần khôi phục gần nhất.'); return;
    }
  };
  $('backup-undo-cancel').onclick = () => { undoArmed = false; $('backup-undo-confirm').hidden = true; };
  $('backup-undo-apply').onclick = () => run(async () => reloadAfter(() => undoRestore(store)));
  document.addEventListener('bmwtube-data-changed', updateLocal);
  window.addEventListener('storage', updateLocal);
  $('backup-banner-open').onclick = () => { $('backup-banner').hidden = true; openSettings(); $('backup-section').scrollIntoView({block: 'start'}); };
  $('backup-banner-close').onclick = () => { $('backup-banner').hidden = true; };
  updateLocal();
  if(location.hash === '#backup-restored') {
    window.history.replaceState(null, '', location.pathname + location.search);
    openSettings(); status('Đã áp dụng dữ liệu trên trình duyệt này.');
    $('backup-section').scrollIntoView({block: 'start'});
  }
  // A public read only; no token or background writes are needed for discovery.
  api.read().then(result => {
    if(operation || busy || remote) return;
    remote = result; preview();
    if(remote && !hasLocalData(store)) $('backup-banner').hidden = false;
  }).catch(() => { /* Manual check reports errors without interrupting playback at startup. */ });
}
