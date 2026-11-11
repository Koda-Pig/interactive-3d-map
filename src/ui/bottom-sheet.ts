/** Matches the phone layout in `style.css`. */
export const PHONE_LAYOUT = "(max-width: 600px)";

/** A press that moves further than this, in pixels, is a drag and not a tap. */
const DRAG_THRESHOLD = 6;
/** A drag has to cover this many pixels to open or close the sheet. */
const SNAP_DISTANCE = 48;

export interface BottomSheetParts {
  readonly sheet: HTMLElement;
  /** The strip that stays in view when closed. Tap or drag it to move the sheet. */
  readonly handle: HTMLElement;
  /** The button in the handle that says whether the sheet is open. */
  readonly grabber: HTMLElement;
  /** A control in the handle that does its own thing when pressed. */
  readonly handleAction: HTMLElement;
}

export interface BottomSheet {
  close(): void;
}

interface Drag {
  readonly pointerId: number;
  readonly startY: number;
  readonly sheetY: number;
  moved: boolean;
}

/** The sidebar's behaviour on a phone, where it slides up from the bottom. */
export function createBottomSheet(parts: BottomSheetParts): BottomSheet {
  const { sheet, handle, grabber, handleAction } = parts;
  const phone = window.matchMedia(PHONE_LAYOUT);

  let open = false;
  let drag: Drag | null = null;
  let draggedSinceLastPress = false;

  function setOpen(next: boolean): void {
    open = next;
    sheet.classList.toggle("sidebar--open", open);
    grabber.setAttribute("aria-expanded", String(open));
    grabber.setAttribute("aria-label", open ? "Hide locations" : "Show locations");
  }

  function isHandleAction(target: EventTarget | null): boolean {
    return target instanceof Node && handleAction.contains(target);
  }

  function endDrag(): void {
    sheet.classList.remove("sidebar--dragging");
    drag = null;
  }

  handle.addEventListener("pointerdown", (event) => {
    draggedSinceLastPress = false;
    if (!phone.matches || isHandleAction(event.target)) {
      return;
    }
    drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      sheetY: new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42,
      moved: false,
    };
  });

  handle.addEventListener("pointermove", (event) => {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(distance) < DRAG_THRESHOLD) {
        return;
      }
      drag.moved = true;
      draggedSinceLastPress = true;
      handle.setPointerCapture(event.pointerId);
      sheet.classList.add("sidebar--dragging");
    }
    sheet.style.setProperty("--sheet-y", `${drag.sheetY + distance}px`);
  });

  handle.addEventListener("pointerup", (event) => {
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientY - drag.startY;
    if (drag.moved && Math.abs(distance) >= SNAP_DISTANCE) {
      setOpen(distance < 0);
    }
    endDrag();
  });

  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("click", (event) => {
    if (phone.matches && !draggedSinceLastPress && !isHandleAction(event.target)) {
      setOpen(!open);
    }
  });

  return {
    close() {
      setOpen(false);
    },
  };
}
