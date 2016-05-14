console.clear();
//
const controls = {
  ArrowRight: { command: 'right' },
  ArrowLeft: { command: 'left' },
  ArrowDown: { command: 'down' }
};

const config = {
  rows: 7,
  cols: 8
};

const initialState = initialStateFactory(config.rows, config.cols);

function initialStateFactory(rows, cols) {
  const emptyCol = [];
  const canvas = [];
  for(let i = 0; i < config.cols; i++) { emptyCol.push(0) }
  for(let i = 0; i < config.rows; i++) { canvas.push([...emptyCol ]) }
  return { 
    canvas, 
    currentBlock: {
      coordinates: [
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
      ]
    }
  };
}

// Blocks
const blockSource = Rx.Observable.range(1, 1000).map(() => Math.floor(Math.random(2342323432) * 7));

// Tick
const tickSource = Rx.Observable.interval(1000);

// Commmands
const downSource = tickSource.map(ev => ({ command: 'down' }));
const controlsSource = Rx.Observable.fromEvent(document, 'keydown').map(k => controls[k.code]).filter(e => e);
const commandSource = downSource.merge(controlsSource);

const actionSource = new Rx.Subject();
commandSource.subscribe(actionSource);

// State
const intialGameStateSource = Rx.Observable.of(initialState);
const gameStateSource = intialGameStateSource
  .merge(actionSource)
  .scan(applyActionToState)
  .publish().refCount();

const hitSource = gameStateSource.filter(isHit);

hitSource.zip(blockSource, (state, block) => ({ 
  command: "next", 
  block: block 
})).subscribe(actionSource);

const completedRowsSource = gameStateSource.filter(hasCompletedRow)
  .map(getCompletedRows)
  .subscribe(() => console.log("row completed"));

gameStateSource.subscribe(domRenderer);

function applyActionToState(state, action) {
  let coordinates = [];
  
  switch(action.command) {
    case 'down':
        coordinates = state.currentBlock.coordinates.map(c => ({ x: c.x, y: c.y + 1 }))
        break;
    case 'left':
        coordinates = !state.currentBlock.coordinates.some(c => c.x - 1 < 0 || state.canvas[c.y][c.x - 1] === 1)
          ? state.currentBlock.coordinates.map(c => ({ x: c.x - 1, y: c.y }))
          : state.currentBlock.coordinates;
        break;
    case 'right':
        coordinates = !state.currentBlock.coordinates.some(c => c.x + 1 >= config.cols || state.canvas[c.y][c.x + 1] === 1)
          ? state.currentBlock.coordinates.map(c => ({ x: c.x + 1, y: c.y }))
          : state.currentBlock.coordinates;
        break;
    case 'next':
        state.currentBlock.coordinates.forEach(c => state.canvas[c.y][c.x] = 1);
        coordinates = [...initialState.currentBlock.coordinates];
        break;
    default:
        break;
  }
  
  return {
    canvas: state.canvas,
    currentBlock: {
      coordinates: coordinates
    }
  };
}

function isHit(state) {
  return state.currentBlock.coordinates.some(c => c.y + 1 >= config.rows || state.canvas[c.y + 1][c.x] === 1);
}

function hasCompletedRow(state) {
  return state.canvas.some(row => row.every(c => c))
}

function getCompletedRows(state) {
  return state.canvas
    .map((row, index) => { return { row, index } })
    .filter(rowAndIndex => rowAndIndex.row.every(c => c))
    .map(rowAndIndex => rowAndIndex.index);
}

function renderState(state) {
  console.clear();
  state.canvas.forEach((row, rowIndex) => {
    console.log(row.map((col, colIndex) => {
      return state.currentBlock.coordinates.some(c => c.x === colIndex && c.y === rowIndex) ? 1 : col;
    }));
  });
}

function domRenderer(state) {
  const squareSize = 15;
  const canvas = document.querySelector('canvas');
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  state.canvas.forEach((row, rowIndex) => {
    row.forEach((col, colIndex) => {
      const isFilled = state.currentBlock.coordinates.some(c => c.x === colIndex && c.y === rowIndex) ? 1 : col;
      if (isFilled) {
        context.fillRect(colIndex * squareSize, rowIndex * squareSize,squareSize,squareSize);  
      } else {
        context.rect(colIndex * squareSize, rowIndex * squareSize,squareSize,squareSize);
        context.stroke();
      }
    });
  });
}