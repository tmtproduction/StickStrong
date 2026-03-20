/**
 * api.js — Frontend API Helper
 * 
 * วิธีใช้: แทนที่ google.script.run ทุกที่ด้วย API.call(...)
 * 
 * เดิม (GAS):
 *   google.script.run
 *     .withSuccessHandler(res => { ... })
 *     .getSystemState();
 * 
 * ใหม่ (GitHub Pages):
 *   API.call('getSystemState')
 *     .then(res => { ... });
 * 
 *   หรือแบบ async/await:
 *   const res = await API.call('getSystemState');
 */

const API = (() => {
  // ─── ตั้งค่า URL ของ GAS Web App ───────────────────────────────────────────
  // หลัง Deploy GAS เป็น Web App แล้ว ให้เอา URL มาใส่ที่นี่
  // รูปแบบ: https://script.google.com/macros/s/XXXXXXXXXX/exec
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzUY6hANtHKMgOByV4Ji2AadeXlvzqr8w9Ioh5K_kyQF5ZCEeN0SU7mW_BrekX35Q/exec';

  /**
   * ฟังก์ชันหลัก — ส่ง POST request ไป GAS
   * @param {string} action   — ชื่อ action ตาม doPost router
   * @param {object} params   — parameters เพิ่มเติม (optional)
   * @returns {Promise}       — resolve ด้วย response data
   */
  async function call(action, params = {}) {
    const body = { action, ...params };
    
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        // หมายเหตุ: GAS ไม่รองรับ CORS preflight แบบปกติ
        // ต้องใช้ mode: 'no-cors' จะทำให้ response เป็น opaque (อ่านไม่ได้)
        // วิธีแก้: ใช้ redirect trick ของ GAS — ดูด้านล่าง
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' }, // ใช้ text/plain เพื่อหลีก preflight
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();

    } catch (err) {
      console.error(`[API] ${action} failed:`, err);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Shorthand methods — ชื่อตาม google.script.run เดิมเพื่อ migrate ง่าย
  //  แต่ละฟังก์ชันรับ params แล้ว forward ไป call()
  // ─────────────────────────────────────────────────────────────────────────

  return {
    call, // ใช้ตรงๆ ได้เลย: API.call('action', { param1, param2 })

    // ── System ──────────────────────────────────────────────────────────────
    getSystemState:      ()             => call('getSystemState'),
    setSystemState:      (key, value)   => call('setSystemState',      { key, value }),
    setTimerState:       (status, dur)  => call('setTimerState',       { status, duration: dur }),
    setBidStatus:        (round, status)=> call('setBidStatus',        { round, status }),
    setBidReveal:        (value)        => call('setBidReveal',        { value }),
    setQueueVisibility:  (value)        => call('setQueueVisibility',  { value }),

    // ── Leaderboard ─────────────────────────────────────────────────────────
    getLeaderboardData:  ()             => call('getLeaderboardData'),
    saveStructureWeight: (teamId, w)    => call('saveStructureWeight', { teamId, weight: w }),
    saveResult:          (id, r, w, p)  => call('saveResult',         { teamId: id, round: r, weight: w, isPass: p }),
    submitBid:           (token, r, w)  => call('submitBid',          { token, round: r, weight: w }),

    // ── Weight Call ──────────────────────────────────────────────────────────
    triggerWeightCall:   (teamId)       => call('triggerWeightCall',   { teamId }),
    teamSubmitFinal:     (token, w)     => call('teamSubmitFinal',     { token, weight: w }),

    // ── Power Cards ──────────────────────────────────────────────────────────
    useCard:             (token, type)  => call('useCard',             { token, type }),
    getMyCards:          (token)        => call('getMyCards',          { token }),
    adminResetCards:     ()             => call('adminResetCards'),

    // ── Auth ─────────────────────────────────────────────────────────────────
    teamLogin:           (passcode)     => call('teamLogin',           { passcode }),
    spectatorLogin:      (id, nickname) => call('spectatorLogin',      { id, nickname }),

    // ── Spectator / Betting ──────────────────────────────────────────────────
    getUserBalance:      (userId)       => call('getUserBalance',      { userId }),
    placeBet:            (userId, teamId, prediction, amount) =>
                                          call('placeBet',            { userId, teamId, prediction, amount }),
    getLiveOdds:         (teamId)       => call('getLiveOdds',         { teamId }),
    getMyTransactions:   (userId)       => call('getMyTransactions',   { userId }),
    getActiveBetStats:   (teamId)       => call('getActiveBetStats',   { teamId }),

    // ── Payload ──────────────────────────────────────────────────────────────
    investPayload:       (userId, side, amount) =>
                                          call('investPayload',       { userId, side, amount }),

    // ── Admin ─────────────────────────────────────────────────────────────────
    triggerChampionSummary: ()          => call('triggerChampionSummary'),
    closeSummary:        ()             => call('closeSummary'),
  };
})();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MIGRATION GUIDE — เปลี่ยนแต่ละ page ยังไง
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Pattern เดิม (google.script.run):
 *  ────────────────────────────────
 *  google.script.run
 *    .withSuccessHandler(res => doSomething(res))
 *    .withFailureHandler(err => console.error(err))
 *    .getSystemState();
 *
 *  Pattern ใหม่ (API.call):
 *  ─────────────────────────
 *  // แบบ .then()
 *  API.getSystemState()
 *    .then(res => doSomething(res))
 *    .catch(err => console.error(err));
 *
 *  // แบบ async/await (แนะนำ — อ่านง่ายกว่า)
 *  async function syncState() {
 *    const res = await API.getSystemState();
 *    doSomething(res);
 *  }
 *
 *  ตัวอย่างจริงจาก Spectator.html:
 *  ─────────────────────────────────
 *  เดิม:
 *    google.script.run.withSuccessHandler(s => { ... }).getSystemState();
 *
 *  ใหม่:
 *    API.getSystemState().then(s => { ... });
 *
 *  เดิม:
 *    google.script.run.withSuccessHandler(res => {
 *      if(res.success) { userData = res; ... }
 *    }).spectatorLogin(id, nick);
 *
 *  ใหม่:
 *    API.spectatorLogin(id, nick).then(res => {
 *      if(res.success) { userData = res; ... }
 *    });
 * ─────────────────────────────────────────────────────────────────────────────
 */
