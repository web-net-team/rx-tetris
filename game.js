console.clear();

const controls = {
  ArrowRight: { command: 'right' },
  ArrowLeft: { command: 'left' },
  ArrowDown: { command: 'down' },
  ArrowUp: { command: 'clock' },
  y: { command: 'counter' }
};

const config = {
  rows: 12,
  cols: 8
};

const tickTime = 500;
const lockDelay = 100;

const blocks = [ { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 3, y: 1 },
                                  { x: 4, y: 1 } ],
                   reference: { x: 3, y: 0 },
                   edge: 2 },
                 { coordinates: [ { x: 2, y: 0 },
                                  { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 } ],
                   reference: { x: 2, y: -1 },
                   edge: 4 },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 4, y: 1 },
                                  { x: 5, y: 1 } ],
                   reference: { x: 3, y: 0 },
                   edge: 3 },
                 { coordinates: [ { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 3, y: 1 },
                                  { x: 4, y: 1 } ],
                   reference: { x: 3, y: -1 },
                   edge: 3 },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 4, y: 1 } ],
                   reference: { x: 3, y: -1 },
                   edge: 3 },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 3, y: 1 } ],
                   reference: { x: 3, y: -1 },
                   edge: 3 },
                 { coordinates: [ { x: 3, y: 0 },
                                  { x: 4, y: 0 },
                                  { x: 5, y: 0 },
                                  { x: 5, y: 1 } ],
                   reference: { x: 3, y: -1 },
                   edge: 3 }
];

const initialState = initialStateFactory(config.rows, config.cols);

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
    currentBlock: blocks[getRandomBlock()]
  };
}

// Blocks
// todo: use random generator: http://tetris.wikia.com/wiki/Random_Generator
// todo: make infinite stream => possibly use start
const blockSource = Rx.Observable
  .range(1, 1000)
  .map(getRandomBlock);
  
 function getRandomBlock() {
   return Math.floor(Math.random() * 7);
 }

// Tick
const tickSource = Rx.Observable.interval(tickTime);

// Commmands
const downSource = tickSource.map(ev => ({ command: 'down' }));
const controlsSource = Rx.Observable
  .fromEvent(document, 'keydown')
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
  .publish()
  .refCount();

const hitSource = gameStateSource
  .filter(isLock)
  .debounce(x => Rx.Observable.timer(lockDelay));

hitSource
  .zip(blockSource, (state, block) => ({ command: 'next', 
                                         block: block }))
  .subscribe(actionSource);

// todo: filter after getCompletedRows not before
gameStateSource
  .filter(hasCompletedRow)
  .map(getCompletedRows)
  .map(rows => ({ command: 'completed', 
                  rows }))
  .subscribe(actionSource);

gameStateSource.subscribe(domRenderer);

function applyActionToState(state, action) {
  // clone the complete state
  let coordinates = [...state.currentBlock.coordinates];
  let canvas = [...state.canvas.map(row => [...row])];
  let reference = { x: state.currentBlock.reference.x,
                    y: state.currentBlock.reference.y };
  let edge = state.currentBlock.edge;
  
  let nextCoordinates;
  
  switch(action.command) {
    case 'down':
        nextCoordinates = coordinates.map(c => ({ x: c.x, y: c.y + 1 }))
        
        if (isValidPosition(canvas, nextCoordinates)) {
          coordinates = nextCoordinates;
          reference.y++;          
        }
        break;
    case 'left':
        nextCoordinates = coordinates.map(c => ({ x: c.x - 1, y: c.y })); 
    
        if (isValidPosition(canvas, nextCoordinates)) {
          coordinates = nextCoordinates;          
          reference.x--;
        }
        break;
    case 'right':
        nextCoordinates = coordinates.map(c => ({ x: c.x + 1, y: c.y }));    
    
        if (isValidPosition(canvas, nextCoordinates)) {
          coordinates = nextCoordinates;          
          reference.x++;          
        }
        break;
    case 'clock':
        nextCoordinates = coordinates.map(c => ({ 
          x: (1 - ((c.y - reference.y) - (edge - 2))) + reference.x, 
          y: (c.x - reference.x) + reference.y
        }))
        
        if (isValidPosition(canvas, nextCoordinates)) {
          coordinates = nextCoordinates;          
        }
        break;
    case 'next':
        coordinates.forEach(c => canvas[c.y][c.x] = 1);
        coordinates = [...blocks[action.block].coordinates];
        reference.x = blocks[action.block].reference.x;
        reference.y = blocks[action.block].reference.y;
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
  
  return {
    canvas: canvas,
    currentBlock: {
      coordinates: coordinates,
      reference: reference,
      edge: edge
    }
  };
}

function isLock(state) {
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

function isValidPosition(canvas, coordinates) {  
  return !coordinates.some(c => c.x < 0 || c.x >= config.cols || c.y >= config.rows || (c.y >= 0 && canvas[c.y][c.x] === 1))
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
  const squareSize = 50;
  const canvas = document.querySelector('canvas#blocks');
  const context = canvas.getContext("2d");
  
  // offscreen canvas
  const off_canvas = document.createElement('canvas');
  off_canvas.width = canvas.width;
  off_canvas.height = canvas.height;
  const off_context = off_canvas.getContext('2d');
  
  state.canvas.forEach((row, rowIndex) => {
    row.forEach((col, colIndex) => {
      const isFilled = state.currentBlock.coordinates.some(c => c.x === colIndex && c.y === rowIndex) ? 1 : col;
      if (isFilled) {
        off_context.fillRect(colIndex * squareSize, rowIndex * squareSize, squareSize, squareSize);  
      }
    });
  });
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(off_canvas, 0, 0);
}

function renderRaster() {
  const squareSize = 50;
  const canvas = document.querySelector('canvas#raster');
  const context = canvas.getContext("2d");
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      context.strokeStyle = "#AAA";
      context.strokeRect(col * squareSize, row * squareSize, squareSize, squareSize);
    }
  }
}

renderRaster();