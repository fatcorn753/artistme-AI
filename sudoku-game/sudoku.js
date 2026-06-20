// ── Sudoku engine ─────────────────────────────────────
function makeSolver() {
  function solve(board) {
    const empty = findEmpty(board);
    if (!empty) return true;
    const [r, c] = empty;
    const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random()-0.5);
    for (const n of nums) {
      if (isValid(board, r, c, n)) {
        board[r][c] = n;
        if (solve(board)) return true;
        board[r][c] = 0;
      }
    }
    return false;
  }
  function findEmpty(board) {
    for (let r=0;r<9;r++) for (let c=0;c<9;c++) if(!board[r][c]) return [r,c];
    return null;
  }
  function isValid(board, r, c, n) {
    if (board[r].includes(n)) return false;
    if (board.some(row => row[c]===n)) return false;
    const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
    for (let i=0;i<3;i++) for (let j=0;j<3;j++) if(board[br+i][bc+j]===n) return false;
    return true;
  }
  return { solve, isValid, findEmpty };
}

const { solve, isValid, findEmpty } = makeSolver();

function generatePuzzle(difficulty) {
  const solution = Array.from({length:9},()=>Array(9).fill(0));
  solve(solution);

  const removals = { easy: 30, medium: 45, hard: 55 };
  const puzzle   = solution.map(r=>[...r]);
  let toRemove   = removals[difficulty];
  const cells    = [...Array(81).keys()].sort(()=>Math.random()-0.5);

  for (const idx of cells) {
    if (toRemove <= 0) break;
    const r=Math.floor(idx/9), c=idx%9;
    const backup=puzzle[r][c]; puzzle[r][c]=0;
    // Basic uniqueness check: count solutions (simplified - just remove)
    toRemove--;
  }
  return { puzzle, solution };
}

// ── Game state ────────────────────────────────────────
let puzzle=[], solution=[], userGrid=[], notes=[], selected=null, mistakes=0;
let difficulty='easy', timerSec=0, timerRunning=false, timerInterval=null;
let notesMode=false, bestTimes={easy:null,medium:null,hard:null};
let history=[];

// ── Timer ─────────────────────────────────────────────
function startTimer(){
  timerRunning=true; timerSec=0;
  timerInterval=setInterval(()=>{timerSec++;updateTimerDisplay();},1000);
}
function stopTimer(){ clearInterval(timerInterval); timerRunning=false; }
function updateTimerDisplay(){
  const m=Math.floor(timerSec/60),s=timerSec%60;
  document.getElementById('timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── New game ──────────────────────────────────────────
function newGame(){
  const gen=generatePuzzle(difficulty);
  puzzle=gen.puzzle.map(r=>[...r]);
  solution=gen.solution;
  userGrid=puzzle.map(r=>[...r]);
  notes=Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  selected=null; mistakes=0; history=[];
  document.getElementById('mistakes').textContent='❌ 0/3';
  document.getElementById('message').className='message hidden';
  stopTimer(); startTimer();
  renderBoard();
  updateBestDisplay();
}

// ── Board rendering ───────────────────────────────────
function renderBoard(){
  const board=document.getElementById('sudoku-board');
  board.innerHTML='';
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    const cell=document.createElement('div');
    cell.className='cell';
    cell.dataset.r=r; cell.dataset.c=c;

    const isGiven=puzzle[r][c]!==0;
    const val=userGrid[r][c];

    if(isGiven) cell.classList.add('given');
    if(selected&&selected[0]===r&&selected[1]===c) cell.classList.add('selected');

    // Highlight same number
    if(selected&&val&&val===userGrid[selected[0]][selected[1]]) cell.classList.add('highlight');
    // Highlight row/col/box of selected
    if(selected&&!cell.classList.contains('selected')){
      const [sr,sc]=selected;
      if(sr===r||sc===c||( Math.floor(sr/3)===Math.floor(r/3)&&Math.floor(sc/3)===Math.floor(c/3)))
        if(!cell.classList.contains('highlight')) cell.classList.add('highlight');
    }

    if(val){
      const isWrong = val!==solution[r][c];
      if(isWrong&&!isGiven) cell.classList.add('error');
      else if(!isGiven&&val===solution[r][c]) cell.classList.add('correct');
      cell.textContent=val;
    } else {
      // Notes
      const cellNotes=notes[r][c];
      if(cellNotes.size>0){
        const notesDiv=document.createElement('div'); notesDiv.className='cell-notes';
        for(let n=1;n<=9;n++){
          const nd=document.createElement('div'); nd.className='note-num'+(cellNotes.has(n)?' filled':'');
          nd.textContent=cellNotes.has(n)?n:''; notesDiv.appendChild(nd);
        }
        cell.appendChild(notesDiv);
      }
    }

    cell.addEventListener('click',()=>selectCell(r,c));
    board.appendChild(cell);
  }
}

function selectCell(r,c){ selected=[r,c]; renderBoard(); }

// ── Input ─────────────────────────────────────────────
function inputNum(n){
  if(!selected) return;
  const [r,c]=selected;
  if(puzzle[r][c]!==0) return; // Given cell

  if(n===0){ // Clear
    history.push(userGrid.map(row=>[...row]));
    userGrid[r][c]=0; notes[r][c].clear();
    renderBoard(); return;
  }

  if(notesMode){
    if(notes[r][c].has(n)) notes[r][c].delete(n); else notes[r][c].add(n);
    renderBoard(); return;
  }

  history.push(userGrid.map(row=>[...row]));
  userGrid[r][c]=n;

  if(n!==solution[r][c]){
    mistakes++;
    document.getElementById('mistakes').textContent=`❌ ${mistakes}/3`;
    if(mistakes>=3){ stopTimer(); showMessage('💀 ゲームオーバー！3回間違えました','fail'); }
  }

  // Clear notes in row/col/box
  for(let i=0;i<9;i++){ notes[r][i].delete(n); notes[i][c].delete(n); }
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) notes[br+i][bc+j].delete(n);

  // Check win
  if(userGrid.every((row,ri)=>row.every((v,ci)=>v===solution[ri][ci]))){
    stopTimer();
    const time=fmtTime(timerSec);
    if(!bestTimes[difficulty]||timerSec<bestTimes[difficulty]){
      bestTimes[difficulty]=timerSec;
      chrome.storage.local.set({sudokuBest:bestTimes});
    }
    showMessage(`🎉 クリア！ ${time}`, 'success');
  }
  renderBoard();
}

function fmtTime(s){ const m=Math.floor(s/60); return `${m}分${s%60}秒`; }

function showMessage(text, type){
  const el=document.getElementById('message');
  el.textContent=text; el.className=`message ${type}`;
}

// ── Controls ──────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); difficulty=btn.dataset.diff;
  });
});
document.getElementById('btn-new').addEventListener('click', newGame);

document.getElementById('btn-undo').addEventListener('click',()=>{
  if(!history.length) return;
  userGrid=history.pop(); renderBoard();
});

document.getElementById('btn-hint').addEventListener('click',()=>{
  if(!selected) return;
  const [r,c]=selected;
  if(userGrid[r][c]===solution[r][c]) return;
  history.push(userGrid.map(row=>[...row]));
  userGrid[r][c]=solution[r][c];
  // Mark as hint
  const cells=document.querySelectorAll('.cell');
  cells[r*9+c].classList.add('hint-cell');
  renderBoard();
});

document.getElementById('btn-check').addEventListener('click',()=>{
  let errors=0;
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    if(userGrid[r][c]&&userGrid[r][c]!==solution[r][c]) errors++;
  }
  showMessage(errors?`❌ ${errors}箇所間違いがあります`:'✅ 全て正しいです！', errors?'fail':'success');
  setTimeout(()=>document.getElementById('message').className='message hidden',2000);
});

const noteBtn=document.getElementById('btn-notes');
noteBtn.addEventListener('click',()=>{
  notesMode=!notesMode;
  noteBtn.classList.toggle('active',notesMode);
  noteBtn.textContent=notesMode?'📝 ON':'📝';
});

// Numpad
const numpad=document.getElementById('numpad');
for(let n=1;n<=9;n++){
  const btn=document.createElement('button'); btn.className='num-btn'; btn.textContent=n; btn.dataset.n=n;
  btn.addEventListener('click',()=>inputNum(n)); numpad.appendChild(btn);
}
// Clear btn
const clearBtn=document.createElement('button'); clearBtn.className='num-btn'; clearBtn.textContent='✕'; clearBtn.dataset.n=0;
clearBtn.style.gridColumn='span 9'; clearBtn.style.height='28px'; clearBtn.style.fontSize='12px'; clearBtn.style.color='#6b7280';
clearBtn.addEventListener('click',()=>inputNum(0)); numpad.appendChild(clearBtn);

// Keyboard
document.addEventListener('keydown',e=>{
  if(e.key>='1'&&e.key<='9') inputNum(parseInt(e.key));
  if(e.key==='Backspace'||e.key==='Delete'||e.key==='0') inputNum(0);
  if(!selected) return;
  const [r,c]=selected;
  if(e.key==='ArrowUp'&&r>0)    selectCell(r-1,c);
  if(e.key==='ArrowDown'&&r<8)  selectCell(r+1,c);
  if(e.key==='ArrowLeft'&&c>0)  selectCell(r,c-1);
  if(e.key==='ArrowRight'&&c<8) selectCell(r,c+1);
  e.preventDefault();
});

function updateBestDisplay(){
  ['easy','medium','hard'].forEach(d=>{
    const el=document.getElementById('best-'+d);
    el.textContent=bestTimes[d]?fmtTime(bestTimes[d]):'—';
  });
}

// ── Init ──────────────────────────────────────────────
chrome.storage.local.get(['sudokuBest'],d=>{
  bestTimes=d.sudokuBest||{easy:null,medium:null,hard:null};
  updateBestDisplay(); newGame();
});
