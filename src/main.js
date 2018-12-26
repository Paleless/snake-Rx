//package
import {
    fromEvent,
    interval,
    BehaviorSubject,
    combineLatest
} from 'rxjs'
import {
    map,
    filter,
    scan,
    tap,
    skip,
    distinctUntilChanged,
    startWith,
    share,
    withLatestFrom,
    takeWhile
} from 'rxjs/operators'

//vars
const COLS = 30;
const ROWS = 30;
const CELL_SIZE = 10;
const CANVAS_WIDTH = COLS * CELL_SIZE;
const CANVAS_HEIGHT = ROWS * CELL_SIZE;
const SPEED = 60;

//dirty
function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.height = CANVAS_HEIGHT;
    canvas.width = CANVAS_WIDTH;
    canvas.style.border = '1px dashed'
    return canvas;
}

const canvas = createCanvas();
const ctx = canvas.getContext('2d');
//dirty
document.getElementById('app').appendChild(canvas);

//root stream
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
    return contrasted ? prev : next;
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

//score$
const score$ = snakeLength$
    .pipe(
        startWith(0),
        scan((score) => score + 1)
    )

//time$ -> snake$ -> apple$ -> appleEaten$
function addCell({ x: x1, y: y1 }, { x: x2, y: y2 }) {
    return {
        x: x1 + x2,
        y: y1 + y2
    }
}

//snake$
const move = (() => {
    const fixPosition = ({ x, y }) => {
        x = x < 0 ? COLS + x : x > COLS ? COLS - x : x
        y = y < 0 ? ROWS + y : y > ROWS ? ROWS - y : y
        return { x, y }
    }
    const generateBody = (snakeLength) => {
        const resultL = new Array(snakeLength).fill(null).map((_, index) => ({
            x: index,
            y: 0
        })).reverse()
        return resultL;
    }
    return (body, [direction, snakeLength]) => {
        if (body.length === 0) {
            body = generateBody(snakeLength);
        } else {
            let oldHead = body[0];
            let bodyLength = body.length;
            let newHead = addCell(oldHead, direction);
            let newBody = snakeLength > bodyLength ? body : body.slice(0, -1);
            body = [newHead, ...newBody].map(fixPosition);
        }
        return body;
    }
})()

const snake$ = time$
    .pipe(
        withLatestFrom(direction$, snakeLength$, (_, direction, snakeLength) => [direction, snakeLength]),
        scan(move, []),
        share()
    )


//apples$
const eqCELL = (x1, x2) => x1.x === x2.x && x1.y === x2.y;
const eat = (() => {
    const generateRandomCELL = () => {
        const randomX = Math.floor(Math.random() * COLS);
        const randomY = Math.floor(Math.random() * ROWS);
        return {
            x: randomX,
            y: randomY
        }
    }
    return (applePosition, body) => {
        if (!applePosition || body.some(item => eqCELL(item, applePosition))) {
            applePosition = generateRandomCELL();
        }
        return applePosition;
    }
})()

const apples$ = snake$
    .pipe(
        scan(eat, false),
        distinctUntilChanged(),
        share()
    )

const appleEaten$ = apples$
    .pipe(
        skip(1),
        tap(() => length$.next(1))
    )
    .subscribe();

//scene$ -> game$
//-- dirty render
const renderScene = (() => {
    const renderSnake = (body) => {
        body.forEach(({ x, y }) => {
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        })
    }
    const renderApple = ({ x, y }) => {
        ctx.save();
        ctx.fillStyle = "red";
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.restore();
    }
    const renderScore = score => {
        ctx.fillText(`score:${score}`, COLS / 2 * CELL_SIZE, ROWS / 2 * CELL_SIZE);
    }
    return (ctx, [snake, apple, score]) => {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        renderSnake(snake, ctx)
        renderApple(apple, ctx)
        renderScore(score, ctx)
    }
})()

function renderGameOver(ctx) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillText(`it's done`, COLS / 2 * CELL_SIZE, ROWS / 2 * CELL_SIZE);
}

function isGameOver([
    [head, ...tail], applePosition, score
]) {
    return tail.some(item => eqCELL(item, head))
}

const scene$ = combineLatest(snake$, apples$, score$)
const game$ = time$
    .pipe(
        withLatestFrom(scene$, (_, scene) => scene),
        takeWhile(scene => !isGameOver(scene))
    )
    .subscribe({
        next: scene => renderScene(ctx, scene),
        complete: () => renderGameOver(ctx)
    })