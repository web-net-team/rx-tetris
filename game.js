console.clear();
//
const controls = {
  ArrowRight: { command: 'right' },
  ArrowLeft: { command: 'left' }
};

const config = {
  rows: 10
};

const initialState = {
  canvas: [],
  currentBlock: {
    coordinates: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
  }
};

for(let i = 0; i < config.rows; i++) { initialState.canvas.push([ 0, 0, 0, 0, 0, 0, 0 ]) }

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

const hitSource = gameStateSource.filter(state => {
  return state.currentBlock.coordinates.some(c => c.y >= config.rows-1);
});

hitSource.do(x => console.log("prezip")).zip(blockSource, (state, block) => ({ 
  command: "next", 
  block: block 
})).subscribe(actionSource); 

gameStateSource.subscribe(domRenderer);

function applyActionToState(state, action) {
  let coordinates = [];
  
  switch(action.command) {
    case 'down':
        coordinates = state.currentBlock.coordinates.map(c => ({ x: c.x, y: c.y + 1 }))
        break;
    case 'left':
        coordinates = state.currentBlock.coordinates.map(c => ({ x: c.x - 1, y: c.y }))
        break;
    case 'right':
        coordinates = state.currentBlock.coordinates.map(c => ({ x: c.x + 1, y: c.y }))
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

function renderState(state) {
  console.clear();
  state.canvas.forEach((row, rowIndex) => {
    console.log(row.map((col, colIndex) => {
      return state.currentBlock.coordinates.some(c => c.x === colIndex && c.y === rowIndex) ? 1 : col;
    }));
  });
}

function domRenderer(state) {
  const squareSize = 20;
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