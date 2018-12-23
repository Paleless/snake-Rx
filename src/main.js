//package
import {
    fromEvent,
    of ,
    interval,
    from,
    BehaviorSubject,
    combineLatest
} from 'rxjs'
import {
    map,
    filter,
    scan,
    tap,
    skip,
    mergeAll,
    distinctUntilChanged,
    startWith,
    publish,
    share,
    withLatestFrom,
} from 'rxjs/operators'

//vars
const COLS = 30;
const ROWS = 30;
const CELL_SIZE = 10;
const CANVAS_WIDTH = COLS * CELL_SIZE;
const CANVAS_HEIGHT = ROWS * CELL_SIZE;
const SPEED = 1000;

//dirty
function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.height = CANVAS_HEIGHT;
    canvas.width = CANVAS_WIDTH;
    return canvas;
}

const canvas = createCanvas();
const ctx = canvas.getContext('2d');
//dirty
document.getElementById('app').appendChild(canvas);

//stream
const keydown$ = fromEvent(document, 'keydown');
const time$ = interval(SPEED);

//keydown$ -> direction$
const DIRECTIONS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
}

const INITIAL_DIRECTION = DIRECTIONS.ArrowRight;

function isContrast(prev, next) {
    const contrasted = prev.x === next.x == 1 ||
        prev.y === next.y == 1
    if (contrasted) {
        return prev;
    }
    return next;
}

const direction$ = keydown$
    .pipe(
        map(({ code }) => DIRECTIONS[code]),
        filter(direction => !!direction),
        scan(isContrast),
        distinctUntilChanged(),
        startWith(INITIAL_DIRECTION),
    )


//length$ -> snakeLength$ -> $score
const INITIAL_LENGTH = 3;
const length$ = new BehaviorSubject(INITIAL_LENGTH)
const snakeLength$ = length$
    .pipe(
        scan((step, snakeLength) => step + snakeLength),
        share()
    )
const score$ = snakeLength$
    .pipe(
        startWith(0),
        scan((score) => score + 1)
    )

//time$ -> snake$ -> apple$ -> appleEaten$
const snake$ = time$
    .pipe(
        withLatestFrom(direction$, snakeLength$, (_, direction, snakeLength) => [direction, snakeLength]),
        // scan(move, generateSnake),
        share()
    )

const apples$ = snake$
    .pipe(
        // scan(eat, generateApples),
        distinctUntilChanged(),
        share()
    )

const appleEaten$ = apples$
    .pipe(
        skip(1),
        tap(() => length$.next(1))
    )
    .subscribe(console.log);

//scene$ -> game$
const scene$ = combineLatest(snake$, apples$, score$ => ({ snake, apples, score }))
const game$ = time$ 
    .pipe(
        withLatestFrom(scene$,(_, scene)=>scene),
        takeWhile(scene => !isGameOver(scene))
    )
    .subscribe({
        // next: scene => renderScene(ctx,scene),
        // complete: () => renderGameOver(ctx)
    })