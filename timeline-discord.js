// timeline-discord.js
// ========================================
// Discordコピー・クリップボード機能
// ========================================

function copySessionToClipboard() {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;

  let text = `**【${session.name}】**\n`;
  session.logs.forEach(log => {
    text += generateRowText(log) + '\n';
  });

  navigator.clipboard.writeText(text).then(() => {
    showNotification('Discordにコピーしました！', 'success');
  }).catch(err => {
    console.error('Copy failed', err);
    showNotification('コピーに失敗しました', 'error');
  });
}

function copyRow(logId) {
  const session = sessions.find(s => s.id === currentSessionId);
  if (!session) return;
  const log = session.logs.find(l => l.id === logId);
  if (!log) return;

  const rowText = generateRowText(log);
  navigator.clipboard.writeText(rowText).then(() => {
    showNotification('行をコピーしました', 'success');
  });
}

function generateRowText(log) {
  const baseDmg = parseFloat(log.damage);
  
  // 1. 絵文字 (0ダメージ時は表示しない)
  let typeIcon = '';
  if (!isNaN(baseDmg) && baseDmg > 0) {
    if (log.attackMode === 'magical') typeIcon = '🔮';
    else if (log.attackMode === 'physical') typeIcon = '⚔️';
    else typeIcon = '✴️';
  }

  // 2. 軽減スキルの文字列化
  let mitStr = "";
  if (log.mitigations.length > 0) {
    const sortedMits = allMitigations.filter(m => log.mitigations.includes(m.id));
    mitStr = sortedMits.map(m => ` \`${m.name}\``).join("");
  }

  // 3. ダメージ情報 (Bar→バリア量, Res→軽減後)
  const mitigated = log.mitigated ? Number(log.mitigated).toLocaleString() : null;
  const dmg = mitigated ? `=\`軽減後${mitigated}\`` : "";

  // 4. メモ
  const memo = log.memo ? ` (${log.memo}) ` : " ";

  // 5. 軽減率 (0%の場合は表示しない)
  const rate = calculateMitigationRate(log);
  const rateStr = (rate > 0) ? ` [ ${rate}%軽減 ]` : "";

  // 6. 不足軽減・危険ライン
  let neededStr = "";
  const neededMit = calculateNeededMitigation(log);
  const mitClass = getMitigatedClass(log);
  
  if (neededMit !== null && neededMit > 0) {
    const alertIcon = (mitClass === 'danger') ? '🚫' : (mitClass === 'warning') ? '⚠️' : '';
    neededStr = ` ${alertIcon}+${neededMit}%軽減必要`;
  } else if (mitClass === 'danger') {
    neededStr = ` 🚫DEAD`;
  } else if (mitClass === 'warning') {
    neededStr = ` ⚠️HP注意`;
  }

  // 7. バースト絵文字
  let burstIcon = "";
  if (log.title.includes("バースト") || (log.typeIds && log.typeIds.includes('burst'))) {
    burstIcon = " 🎊";
  }

  // フォーマット結合: [時間] (メモ) アイコン**タイトル**...
  return `\`[${log.time}]\`${memo}${typeIcon}**${log.title}**${burstIcon}${mitStr}${dmg}${rateStr}${neededStr}`;
}