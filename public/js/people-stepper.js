/* Accessible, touch-friendly number stepper for the "Persone" field.
 * Guarantees the underlying <input> always holds a valid integer >= min.
 */
(function () {
  function clamp(value, min, max) {
    if (isNaN(value)) value = min;
    if (max !== undefined && max !== null && !isNaN(max)) value = Math.min(value, max);
    value = Math.max(value, min);
    return value;
  }

  function bindStepper(stepper) {
    if (!stepper || stepper.dataset.bound === '1') return;
    stepper.dataset.bound = '1';

    const input = stepper.querySelector('.people-stepper__input');
    if (!input) return;

    const min = parseInt(input.min, 10) || 1;
    const max = input.max ? parseInt(input.max, 10) : null;

    function current() {
      const v = parseInt(input.value, 10);
      return isNaN(v) ? min : v;
    }

    function setValue(v) {
      const next = clamp(parseInt(v, 10), min, max);
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    stepper.querySelectorAll('.people-stepper__btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const action = btn.dataset.action;
        setValue(current() + (action === 'inc' ? 1 : -1));
        input.focus({ preventScroll: true });
      });
    });

    // Normalize on blur: empty or invalid falls back to min
    input.addEventListener('blur', function () {
      setValue(current());
    });

    // Block non-digit chars while typing (still allow navigation keys)
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });

    // Initialize value to a clean integer
    setValue(current());
  }

  function bindAll() {
    document.querySelectorAll('.people-stepper').forEach(bindStepper);
  }

  document.addEventListener('DOMContentLoaded', bindAll);
  // Also re-bind if modal content is dynamically recreated
  document.addEventListener('shown.bs.modal', bindAll);
})();
