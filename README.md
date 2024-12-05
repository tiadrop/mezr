## Brief

Abstracted measurements for JS/TS, providing `Distance`, `Angle`, time `Period`, `Weight`, `DataSize`, `Frequency` and an easy way to create your own fully hinted measurement types.

## Description

Worry no more about keeping track of what unit a property or parameter expects. An angle is an angle, a weight is a weight.

```ts
function setRotation(angle: Angle) {
    element.style.transform = `rotate(${angle.asRadians}rad)`;
}

setRotation(Angle.degrees(90));
setRotation(Angle.turns(.25));
```

## Interface

As the API is identical between measurement types, this section will use `Measurement` to refer to any measurement type.

### Creating

Measurements can be created by calling their respective constructor, with or without `new`, passing in a breakdown of units.

```ts
const tenMetres = new Distance({metres: 10});
const eiffelTowerHeight = Distance({feet: 1024});
const djt = Distance({inches: 2.8});
```

Alternatively, we can call `Measurement.<unit>(n)`:

```ts
const antennaHeight = Distance.feet(59);
```

### Arithmetic

We can add, subtract, multiply, divide, modulo and blend Measurements:

```ts
// Measurement.total(measurements)
const totalHeight = Distance.total([eiffelTowerHeight, antennaHeight]);

const totalHeight = eiffelTowerHeight.add(antennaHeight);
const halfHeight = totalHeight.divide(2);
const twentyMetres = tenMetres.multiply(2);

// blend() takes a second Measurement and creates an in-between with a given bias:
const blended = tenMetres.blend(twentyMetres, .5); // 15m
const blended = tenMetres.blend(twentyMetres, .75); // 17.5m

// Unit breakdowns may be used in place of measurement arguments:
const totalHeight = Distance.total([eiffelTowerHeight, {feet: 59}]);
const totalHeight = eiffelTowerHeight.add({feet: 59});

// measurement.absolute
const difference = altitude.subtract(totalHeight).absolute;
```

### Comparison

Measurements can be compared using `equals`, `greaterThan`, `greaterThanOrEqual`, `lessThan` and `lessThanOrEqual`.

```ts
if (altitude.greaterThan({feet: 30})) console.warn("Don't leave without a parachute!");

if (altitude.lessThanOrEqual(totalHeight)) console.warn("Look out for landmarks!");

if (!bagWeight.equals(Weight.total(items.map(i => i.weight)))) {
    speak("Unexpected item in the bagging area!");
}
```

### Reading

At points where you do need a specific unit, it can be read with `measurement.as<Unit>` or `measurement.toUnit(unit)`:

```ts
const heightInFeet = totalHeight.asFeet;
const radians = angle.asRadians;
const heightInMetres = totalHeight.toUnit("metres");
```

Measurements serialise to JSON as objects that are meaningful to humans, by automatically selecting the best (shortest represented) unit, and can be passed back into their respective constructor.

```ts
JSON.stringify(Distance.millimetres(1230)); // { "centimetres": 123 }
```

Measurements can be formatted for display with `measurement.formatNearest()`:

```ts
console.log(totalHeight.formatNearest()); // "330.1 metres"
```

The unit will be automatically selected to produce the closest number to a type-specific target (usually around 500). Both this target and units to consider can be overridden:

```ts
totalHeight.formatNearest(100, ["feet", "inches"]);
```

Measurements can be broken down into object representations with mixed units via `measurement.breakdown()`:

```ts
console.log(Distance.metres(2.5).breakdown()); // Partial<{[unit in FormatUnits]: number}> { metres: 2, centimetres: 50 }
```

We can pass a list of units to `breakdown()` to produce a known structure `{[unit in SpecifiedUnits]: number}`.

## Custom measurement types

To work with custom measurement types, just pass `createMeasurement()` a conversion table:

```ts
export const GameDistance = createMeasurement({
    mapUnits: 1,
    metres: 1/64,
    playerSteps: 1/24,
});

// use MeasurementType<typeof X> to type-ify it
export type GameDistance = MeasurementType<typeof GameDistance>;
```

This gives us a `GameDistance` class with all of Mezr's functionality:

```ts
console.log(GameDistance.playerSteps(1).multiply(2).asMapUnits) // 48
```

We can pass a second argument to `createMeasurement()` to specify some options for the type.

`referenceUnit` selects which unit to store values in behind the scenes. This can maximise precision for unit groups.  
`format` is an object that defines formatting options for your measurement type  
`format.suffices` is a table of `{[unit in U]: string | [string, string]}`, specifying how `formatNearest()` will suffix units. The array specifies [singular, plural].  
`format.defaultTarget` specifies the default numeric target for `formatNearest()` for your measurement type  
`format.units` specifies which units should be considered for JSON encoding and by `formatNearest()` by default.