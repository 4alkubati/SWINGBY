# SwingBy Motion Grammar

> All animations must use these exact curves and durations.
> Mobile: react-native-reanimated v3. Web: Framer Motion 11.
> No CSS transitions on mobile — always reanimated.

---

## Core Curves

| Name | Spec | When to use |
|---|---|---|
| Entry | ease-out, 240ms | Elements appearing: fade in, slide in, scale up |
| Exit | ease-in, 180ms | Elements leaving: fade out, slide out, scale down |
| Transform | spring(stiffness: 220, damping: 22) | Interactive transforms: press, drag, swipe, reorder |

---

## Entry Animations

### Fade In
```
opacity: 0 → 1
duration: 240ms
easing: Easing.out(Easing.cubic)
```

### Slide Up
```
translateY: 20 → 0
opacity: 0 → 1
duration: 240ms
easing: Easing.out(Easing.cubic)
```

### Scale In
```
scale: 0.95 → 1
opacity: 0 → 1
duration: 240ms
easing: Easing.out(Easing.cubic)
```

---

## Exit Animations

### Fade Out
```
opacity: 1 → 0
duration: 180ms
easing: Easing.in(Easing.cubic)
```

### Slide Down
```
translateY: 0 → 20
opacity: 1 → 0
duration: 180ms
easing: Easing.in(Easing.cubic)
```

---

## Interactive Transforms

### Button Press
```
scale: 1 → 0.97
spring: { stiffness: 220, damping: 22 }
haptic: impact(light)
```

### Card Press
```
scale: 1 → 0.98
spring: { stiffness: 220, damping: 22 }
```

### Tab Switch Indicator
```
translateX: current → target
spring: { stiffness: 220, damping: 22 }
haptic: selection()
```

### Bottom Sheet Snap
```
snap points: [0.4, 0.7, 1.0] of screen height
spring: { stiffness: 220, damping: 22 }
rubber-band overshoot at edges
backdrop tap to close
```

---

## Live Pulse (Jet × Pulse)

Used on live/realtime indicators only: "ON THE WAY" status, live map pins, notification dot.

```
dot: 8–9px, accent #6E56F7
ring: expands 0 → ~9px beyond dot, opacity 1 → 0
loop: 1.8s, infinite (reanimated withRepeat)
```

Exempt from the 400ms duration cap below — it is ambient state signaling, not a user-initiated transition.

---

## Forbidden

- No bounces (overdamped springs only — damping ≥ 20)
- No CSS transitions on mobile (always reanimated)
- No durations > 400ms (feels sluggish)
- No linear easing (feels robotic)
- No delay > 100ms on user-initiated actions

---

## Reanimated v3 Examples (Mobile)

### useAnimatedStyle entry
```js
const entering = FadeIn.duration(240).easing(Easing.out(Easing.cubic));
const exiting = FadeOut.duration(180).easing(Easing.in(Easing.cubic));
```

### withSpring transform
```js
const scale = useSharedValue(1);
const onPressIn = () => { scale.value = withSpring(0.97, { stiffness: 220, damping: 22 }); };
const onPressOut = () => { scale.value = withSpring(1, { stiffness: 220, damping: 22 }); };
```

---

## Framer Motion Examples (Web)

### Page transition
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 20 }}
  transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
/>
```

### Button press
```jsx
<motion.button whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} />
```
