console.clear();
//
const controls = {
  ArrowRight: { command: 'right' },
  ArrowLeft: { command: 'left' },
  ArrowDown: { command: 'down' }
};

const config = {
  rows: 12,
  cols: 8
};

const blocks = [ { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 3, y: 1 },
                                  { x: 4, y: 1 } ] },
                 { coordinates: [ { x: 2, y: 0 },
                                  { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 } ] },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 4, y: 1 },
                                  { x: 5, y: 1 } ] },
                 { coordinates: [ { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 3, y: 1 },
                                  { x: 4, y: 1 } ] },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 4, y: 1 } ] },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 3, y: 1 } ] },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 5, y: 1 } ] },
];

const initialState = initialStateFactory(config.rows, config.cols);

renderState(initialState);

function createEmptyRow(cols) {
  const emptyRow = [];
  for(let i = 0; i < cols; i++) { emptyRow.push(0) }
  
  return emptyRow;
}

function initialStateFactory(rows, cols) {
  const emptyRow = createEmptyRow(cols);
  const canvas = [];
  for(let i = 0; i < rows; i++) { canvas.push([...emptyRow ]) }
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
// todo: make infinite
const blockSource = Rx.Observable.range(1, 1000).map(() => Math.floor(Math.random(2342323432) * 7));

// Tick
const tickSource = Rx.Observable.interval(1000);

// Commmands
const downSource = tickSource.map(ev => ({ command: 'down' }));
const controlsSource = Rx.Observable.fromEvent(document, 'keydown')
  .map(k => controls[k.code])
  .filter(e => e);
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
  command: 'next', 
  block: block 
})).subscribe(actionSource);

// todo: filter after getCompletedRows not before
gameStateSource.filter(hasCompletedRow)
  .map(getCompletedRows)
  .map(rows => ({ command: 'completed', 
                  rows }))
  .subscribe(actionSource);

gameStateSource.subscribe(domRenderer);

function applyActionToState(state, action) {
  let coordinates = [...state.currentBlock.coordinates];
  let canvas = [...state.canvas]
  
  switch(action.command) {
    case 'down':
        coordinates = coordinates.map(c => ({ x: c.x, y: c.y + 1 }))
        break;
    case 'left':
        if (!coordinates.some(c => c.x - 1 < 0 || canvas[c.y][c.x - 1] === 1)) {
          coordinates = coordinates.map(c => ({ x: c.x - 1, y: c.y }))
        }
        break;
    case 'right':
        if (!coordinates.some(c => c.x + 1 >= config.cols || canvas[c.y][c.x + 1] === 1)) {
          coordinates = coordinates.map(c => ({ x: c.x + 1, y: c.y }))
        }
        break;
    case 'next':
        coordinates.forEach(c => canvas[c.y][c.x] = 1);
        coordinates = [...blocks[action.block].coordinates];
        break;
    case 'completed':
        action.rows.forEach(rowIndex => {
          canvas.splice(rowIndex, 1)
          canvas.unshift(createEmptyRow(config.cols))
        });
        break;
    default:
        break;
  }
  
  let temp = {
    canvas: canvas,
    currentBlock: {
      coordinates: coordinates
    }
  };
  
  renderState(temp);
  
  return temp;
}

function isHit(state) {
  return state.currentBlock.coordinates.some(c => c.y + 1 >= config.rows || state.canvas[c.y + 1][c.x] === 1);
}

function hasCompletedRow(state) {
  return state.canvas.some(row => row.every(c => c))
}

function getCompletedRows(state) {
  return state.canvas
    .map((row, index) => ({ row, index }))
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