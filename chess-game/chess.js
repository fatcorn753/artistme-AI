// ── Chess engine ──────────────────────────────────────
const PIECES = { K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
const INIT_BOARD = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R'],
];

let board, turn, selected, legalMoves, capturedWhite, capturedBlack, moveHistory, boardHistory, flipped;
let enPassantTarget = null, castlingRights;

function isWhite(p) { return p && p === p.toUpperCase(); }
function isBlack(p) { return p && p === p.toLowerCase(); }
function isFriend(p, t) { return t==='w' ? isWhite(p) : isBlack(p); }
function isEnemy(p, t)  { return t==='w' ? isBlack(p) : isWhite(p); }
function inBounds(r,c)  { return r>=0&&r<8&&c>=0&&c<8; }

function newGame() {
  board = INIT_BOARD.map(r => [...r]);
  turn = 'w'; selected = null; legalMoves = [];
  capturedWhite = []; capturedBlack = [];
  moveHistory = []; boardHistory = [JSON.stringify(board)];
  enPassantTarget = null; flipped = false;
  castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
  render();
}

// ── Move generation ───────────────────────────────────
function rawMoves(b, r, c, t, ep, cr) {
  const p = b[r][c]; if (!p) return [];
  const moves = []; const pt = p.toLowerCase();

  const addIf = (nr,nc) => { if(inBounds(nr,nc) && !isFriend(b[nr][nc],t)) moves.push([nr,nc]); };
  const slide = (dr,dc) => { let nr=r+dr,nc=c+dc; while(inBounds(nr,nc)){if(isFriend(b[nr][nc],t))break; moves.push([nr,nc]); if(b[nr][nc])break; nr+=dr;nc+=dc; } };

  if (pt==='p') {
    const dir = t==='w'?-1:1; const startR = t==='w'?6:1;
    if (inBounds(r+dir,c) && !b[r+dir][c]) {
      moves.push([r+dir,c]);
      if (r===startR && !b[r+dir*2][c]) moves.push([r+dir*2,c]);
    }
    for (const dc of [-1,1]) {
      if (inBounds(r+dir,c+dc) && isEnemy(b[r+dir][c+dc],t)) moves.push([r+dir,c+dc]);
      if (ep && ep[0]===r+dir && ep[1]===c+dc) moves.push([r+dir,c+dc]); // en passant
    }
  } else if (pt==='n') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => addIf(r+dr,c+dc));
  } else if (pt==='b') { [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (pt==='r') { [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (pt==='q') { [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => slide(dr,dc)); }
  else if (pt==='k') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => addIf(r+dr,c+dc));
    // Castling
    if (t==='w' && r===7 && c===4) {
      if (cr.wK && !b[7][5] && !b[7][6] && !isInCheck(b,'w') && !squareAttacked(b,7,5,'b') && !squareAttacked(b,7,6,'b')) moves.push([7,6]);
      if (cr.wQ && !b[7][3] && !b[7][2] && !b[7][1] && !isInCheck(b,'w') && !squareAttacked(b,7,3,'b') && !squareAttacked(b,7,2,'b')) moves.push([7,2]);
    }
    if (t==='b' && r===0 && c===4) {
      if (cr.bK && !b[0][5] && !b[0][6] && !isInCheck(b,'b') && !squareAttacked(b,0,5,'w') && !squareAttacked(b,0,6,'w')) moves.push([0,6]);
      if (cr.bQ && !b[0][3] && !b[0][2] && !b[0][1] && !isInCheck(b,'b') && !squareAttacked(b,0,3,'w') && !squareAttacked(b,0,2,'w')) moves.push([0,2]);
    }
  }
  return moves;
}

function squareAttacked(b, r, c, byColor) {
  for (let rr=0;rr<8;rr++) for (let cc=0;cc<8;cc++) {
    const p = b[rr][cc];
    if (!p) continue;
    if (byColor==='w' && !isWhite(p)) continue;
    if (byColor==='b' && !isBlack(p)) continue;
    const mvs = rawMoves(b,rr,cc,byColor,null,{wK:false,wQ:false,bK:false,bQ:false});
    if (mvs.some(([mr,mc])=>mr===r&&mc===c)) return true;
  }
  return false;
}

function isInCheck(b, t) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) { if(b[r][c]===(t==='w'?'K':'k')) return squareAttacked(b,r,c,t==='w'?'b':'w'); }
  return false;
}

function getLegalMoves(b, r, c, t, ep, cr) {
  const raw = rawMoves(b,r,c,t,ep,cr);
  return raw.filter(([nr,nc]) => {
    const nb = b.map(row=>[...row]);
    applyMoveOnBoard(nb, r, c, nr, nc, ep);
    return !isInCheck(nb, t);
  });
}

function applyMoveOnBoard(b, r, c, nr, nc, ep) {
  const p = b[r][c]; const pt = p?.toLowerCase();
  b[nr][nc] = p; b[r][c] = null;
  // En passant capture
  if (pt==='p' && ep && nr===ep[0] && nc===ep[1]) { b[r][nc]=null; }
  // Castling rook
  if (pt==='k' && Math.abs(nc-c)===2) {
    if (nc===6) { b[r][5]=b[r][7]; b[r][7]=null; }
    if (nc===2) { b[r][3]=b[r][0]; b[r][0]=null; }
  }
  // Promotion
  if (pt==='p' && (nr===0||nr===7)) b[nr][nc] = isWhite(p)?'Q':'q';
}

function hasAnyLegalMove(b, t, ep, cr) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (!b[r][c]) continue;
    if (t==='w'&&!isWhite(b[r][c])) continue;
    if (t==='b'&&!isBlack(b[r][c])) continue;
    if (getLegalMoves(b,r,c,t,ep,cr).length) return true;
  }
  return false;
}

// ── Make move ─────────────────────────────────────────
function makeMove(fromR, fromC, toR, toC) {
  const p = board[fromR][fromC];
  const pt = p?.toLowerCase();
  const captured = board[toR][toC];
  let epCapture = null;

  // En passant capture
  if (pt==='p' && enPassantTarget && toR===enPassantTarget[0] && toC===enPassantTarget[1]) {
    epCapture = board[fromR][toC];
    board[fromR][toC] = null;
  }

  // Track captured
  const cap = captured || epCapture;
  if (cap) {
    if (isWhite(cap)) capturedWhite.push(cap);
    else capturedBlack.push(cap);
  }

  // Move notation
  const files = 'abcdefgh';
  const notation = (p==='P'||p==='p'?'':(PIECES[p]||p)) + files[fromC]+(8-fromR) + (cap?'x':'') + files[toC]+(8-toR);

  boardHistory.push(JSON.stringify(board));
  applyMoveOnBoard(board, fromR, fromC, toR, toC, enPassantTarget);

  // Update castling rights
  if (pt==='k') { if(turn==='w'){castlingRights.wK=false;castlingRights.wQ=false;}else{castlingRights.bK=false;castlingRights.bQ=false;} }
  if (fromR===7&&fromC===0) castlingRights.wQ=false;
  if (fromR===7&&fromC===7) castlingRights.wK=false;
  if (fromR===0&&fromC===0) castlingRights.bQ=false;
  if (fromR===0&&fromC===7) castlingRights.bK=false;

  // En passant target
  enPassantTarget = (pt==='p' && Math.abs(toR-fromR)===2) ? [(fromR+toR)/2, toC] : null;

  // Record move
  if (turn==='w') moveHistory.push({w:notation, b:''});
  else if (moveHistory.length) moveHistory[moveHistory.length-1].b = notation;
  else moveHistory.push({w:'', b:notation});

  turn = turn==='w'?'b':'w';
  selected = null; legalMoves = [];

  // Check game state
  const check = isInCheck(board, turn);
  const noMoves = !hasAnyLegalMove(board, turn, enPassantTarget, castlingRights);
  const statusEl = document.getElementById('status-msg');
  const turnEl   = document.getElementById('turn-indicator');

  if (noMoves && check) {
    statusEl.textContent = `♟ チェックメイト！ ${turn==='w'?'黒':'白'}の勝利！`;
    turnEl.textContent = '🏆 ゲーム終了';
  } else if (noMoves) {
    statusEl.textContent = '⚖ ステールメイト - 引き分け';
    turnEl.textContent = '🤝 引き分け';
  } else if (check) {
    statusEl.textContent = `⚠ ${turn==='w'?'白':'黒'}がチェック！`;
    turnEl.textContent = (turn==='w'?'⬜ 白':'⬛ 黒') + 'の番 (チェック)';
  } else {
    statusEl.textContent = '';
    turnEl.textContent = (turn==='w'?'⬜ 白':'⬛ 黒') + 'の番';
  }

  render();
}

// ── Rendering ─────────────────────────────────────────
const canvas = document.getElementById('chess-canvas');
const ctx = canvas.getContext('2d');
const SQ = 50;

function render() {
  ctx.clearRect(0, 0, 400, 400);
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const dr = flipped ? 7-r : r, dc = flipped ? 7-c : c;
    const light = (r+c)%2===0;
    ctx.fillStyle = light ? '#f0d9b5' : '#b58863';
    ctx.fillRect(c*SQ, r*SQ, SQ, SQ);

    // Highlight selected
    if (selected && selected[0]===dr && selected[1]===dc) {
      ctx.fillStyle = 'rgba(255,255,0,0.4)'; ctx.fillRect(c*SQ,r*SQ,SQ,SQ);
    }
    // Legal move dots
    if (legalMoves.some(([lr,lc])=>lr===dr&&lc===dc)) {
      const hasEnemy = board[dr][dc] && isEnemy(board[dr][dc], turn);
      if (hasEnemy) {
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=4;
        ctx.strokeRect(c*SQ+2,r*SQ+2,SQ-4,SQ-4);
      } else {
        ctx.fillStyle='rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.arc(c*SQ+SQ/2,r*SQ+SQ/2,SQ*0.15,0,Math.PI*2); ctx.fill();
      }
    }
  }

  // Rank/file labels
  ctx.font = '11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  for (let i=0;i<8;i++) {
    const rank = flipped ? i+1 : 8-i;
    const file = String.fromCharCode(97+(flipped?7-i:i));
    ctx.fillStyle=(i%2===0)?'#b58863':'#f0d9b5';
    ctx.fillText(rank, 6, i*SQ+SQ/2);
    ctx.fillText(file, i*SQ+SQ/2, 394);
  }

  // Pieces
  ctx.font = `${SQ*0.7}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const dr=flipped?7-r:r, dc=flipped?7-c:c;
    const p = board[dr][dc]; if (!p) continue;
    ctx.fillStyle = isWhite(p)?'#fff':'#1a1208';
    ctx.strokeStyle = isWhite(p)?'#1a1208':'#fff';
    ctx.lineWidth = 1.2;
    ctx.strokeText(PIECES[p]||p, c*SQ+SQ/2, r*SQ+SQ/2);
    ctx.fillText(PIECES[p]||p, c*SQ+SQ/2, r*SQ+SQ/2);
  }

  // Captured
  document.getElementById('cap-white').textContent = capturedWhite.map(p=>PIECES[p]||p).join('') || '—';
  document.getElementById('cap-black').textContent = capturedBlack.map(p=>PIECES[p]||p).join('') || '—';

  // Move history
  const mlist = document.getElementById('moves-list');
  mlist.innerHTML = moveHistory.map((m,i)=>`
    <div class="move-item">
      <span class="move-num">${i+1}.</span>
      <span class="move-white">${m.w}</span>
      <span class="move-black">${m.b}</span>
    </div>
  `).join('');
  mlist.scrollTop = mlist.scrollHeight;
}

// ── Input ─────────────────────────────────────────────
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor((e.clientX-rect.left)/SQ);
  const cy = Math.floor((e.clientY-rect.top)/SQ);
  const col = flipped ? 7-cx : cx;
  const row = flipped ? 7-cy : cy;
  if (!inBounds(row,col)) return;

  if (selected) {
    if (legalMoves.some(([lr,lc])=>lr===row&&lc===col)) {
      makeMove(selected[0],selected[1],row,col);
      return;
    }
    if (selected[0]===row&&selected[1]===col) { selected=null; legalMoves=[]; render(); return; }
  }

  const p = board[row][col];
  if (p && isFriend(p, turn)) {
    selected = [row,col];
    legalMoves = getLegalMoves(board,row,col,turn,enPassantTarget,castlingRights);
    render();
  } else { selected=null; legalMoves=[]; render(); }
});

// Toolbar
document.getElementById('btn-new-game').addEventListener('click', newGame);
document.getElementById('btn-undo-move').addEventListener('click', () => {
  if (boardHistory.length < 2) return;
  boardHistory.pop(); board = JSON.parse(boardHistory[boardHistory.length-1]);
  turn = turn==='w'?'b':'w';
  if (turn==='w' && moveHistory.length) moveHistory.pop();
  else if (moveHistory.length) moveHistory[moveHistory.length-1].b='';
  capturedWhite.pop(); capturedBlack.pop();
  selected=null; legalMoves=[];
  document.getElementById('status-msg').textContent='';
  document.getElementById('turn-indicator').textContent=(turn==='w'?'⬜ 白':'⬛ 黒')+'の番';
  render();
});
document.getElementById('btn-flip').addEventListener('click', () => { flipped=!flipped; render(); });

// ── Init ─────────────────────────────────────────────
newGame();
