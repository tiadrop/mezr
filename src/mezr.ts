type Measurement<U extends string, FU extends U> = {
    readonly absolute: Measurement<U, FU>;
    toUnit(unit: U): number;
    multiply(n: number): Measurement<U, FU>;
    divide(n: number): Measurement<U, FU>;
    divide(n: Measurement<U, FU> | Description<U>): Measurement<U, FU>;
    remainder(n: number): Measurement<U, FU>;
    blend(target: Measurement<U, FU> | Description<U>, bias?: number): Measurement<U, FU>;
    add(...m: (Measurement<U, FU> | Description<U>)[]): Measurement<U, FU>;
    subtract(m: Measurement<U, FU> | Description<U>): Measurement<U, FU>;
    equals(m: Measurement<U, FU> | Description<U>): boolean;
    greaterThan(m: Measurement<U, FU> | Description<U>): boolean;
    greaterThanOrEqual(m: Measurement<U, FU> | Description<U>): boolean;
    lessThan(m: Measurement<U, FU> | Description<U>): boolean;
    lessThanOrEqual(m: Measurement<U, FU> | Description<U>): boolean;
    floor(unit: U): Measurement<U, FU>;
    ceil(unit: U): Measurement<U, FU>;
    round(unit: U): Measurement<U, FU>;
    breakdown<SU extends U>(units: SU[], options?: BreakdownOptionsIncludeZero): Breakdown<SU>;
    breakdown<SU extends U>(units: SU[], options?: BreakdownOptionsExcludeZero): Partial<Breakdown<SU>>;
    breakdown(): Partial<Breakdown<FU>>;
    formatNearest(target?: number, units?: U[]): string;
} & {
    readonly [k in U as `as${Capitalize<U>}`]: number;
}

type Description<U extends string> = Partial<Record<U, number>>;

type Breakdown<U extends string> = {
    [unit in U]: number;
}

type MeasurementConstructor<U extends string, FU extends U> = {
    new (description: Description<U>): Measurement<U, FU>;
    total(measurements: (Measurement<U, FU> | Description<U>)[]): Measurement<U, FU>;
} & MeasurementConstructorStatics<U, FU> & ((description: Description<U>) => Measurement<U, FU>) 

type MeasurementConstructorStatics<U extends string, FU extends U> = {
    readonly [unit in U]: (amount: number) => Measurement<U, FU>;
};

export type MeasurementType<T extends MeasurementConstructor<any, any>> = T extends MeasurementConstructor<infer U, infer FU> ? Measurement<U, FU> : never;

type MeasurementOptions<U extends string, FU extends U> = {
    referenceUnit?: U;
    format?: {
        suffices?: Partial<Record<U, string | [string, string]>>;
        defaultTarget?: number,
        units?: FU[],
    }
}

type BreakdownOptionsCommon = {
    floatLast?: boolean;
}

type BreakdownOptionsExcludeZero = BreakdownOptionsCommon & {
    includeZero: false,
}

type BreakdownOptionsIncludeZero = BreakdownOptionsCommon & {
    includeZero: true,
}

type BreakdownOptions = BreakdownOptionsIncludeZero | BreakdownOptionsExcludeZero;

function capitalise(s: string) {
    return s[0].toUpperCase() + s.slice(1);
}

type UnitTable = {
    [unit: string]: number;
}

/**
 * @param table Unit conversion table - values should describe equivalents, eg `{metres: 1, centimetres: 100}`
 * @param options Object describing options for your measurement type
 */
export function createMeasurement<T extends UnitTable, FU extends keyof T & string>(
    table: T,
    options?: MeasurementOptions<keyof T & string, FU>
) {
    type U = keyof T & string;
    type M = Measurement<U, FU>;

    const referenceSymbol = Symbol();
    let referenceUnit = options?.referenceUnit;

    function getReferenceValue(measurement: M) {
        return (measurement as any)[referenceSymbol];
    }
    
    const suffices = options?.format?.suffices;
    const formatDefaultTarget = options?.format?.defaultTarget ?? 500;
    const formatDefaultUnits = options?.format?.units;
    
    if (referenceUnit === undefined) {
        // use median
        const values = Object.entries(table);
        values.sort(([ua, va], [ub, vb]) => va - vb);
        referenceUnit = values[Math.floor(values.length / 2)][0];
    }

    const referenceMultiplier = table[referenceUnit] as number;
    
    /**
     * Ensure Measurement (Description -> Measurement)
     */
    function fromDescription(v: M | Description<U>) {
        return (referenceSymbol in v ? v : new measurement(v as Description<U>)) as M & {
            [referenceSymbol]: number;
        };
    }

    function convertUnit(referenceValue: number, unitValue: number) {
        return unitValue * referenceValue;
    }

    const measurement = function Mez(description: Description<U>) {
        type MC = MeasurementConstructor<U, FU>;
        const mc = measurement as MC;
        if (this === undefined) return new mc(description);
        if (this.constructor !== measurement) throw new Error("invalid call");

        const reference = Object.entries(description).reduce((acc, [unit, amount]) => {
            if (isNaN(amount)) {
                throw new Error("Unit '" + unit + "' is NaN");
            }
            const asReference = amount / table[unit];
            return acc + asReference;
        }, 0);
        Object.defineProperties(this, {
            [referenceSymbol]: {
                enumerable: false,
                configurable: false,
                get() { return reference },
            },
            absolute: {
                enumerable: true,
                configurable: false,
                // debating whether this should be precalculated or a getter (pending benchmark?)
                // (if getter, can move back to prototype)
                value: reference >= 0
                    ? this
                    : new mc({
                        [referenceUnit]: Math.abs(reference * table[referenceUnit])
                    } as any)
                
            },
        });
    } as MeasurementConstructor<U, FU>;

    function getBreakdown(source: M, units: (U)[], options: BreakdownOptions) {
        if (units.length == 0) return {};
        units = [...units];
        units.sort((a, b) => {
            return convertUnit(1, table[a]) - convertUnit(1, table[b]);
        });

        const negative = getReferenceValue(source) < 0;
        const breakdown: Partial<Record<string, number>> = {};
        let remaining = source;
        if (negative) remaining = remaining.multiply(-1);

        units.forEach(unit => {
            const preciseAmount = (remaining as any).toUnit(unit);
            const amount = options.floatLast && unit == units[units.length - 1]
                ? preciseAmount
                : Math.floor(preciseAmount);
            if (options.includeZero || amount !== 0) {
                breakdown[unit] = amount;
                remaining = remaining.subtract({[unit]: amount} as Description<U>);
            }
        });

        if (negative) return Object.fromEntries(Object.entries(breakdown).map(([unit, amount]) => [unit, 0 - amount]));

        if (Object.keys(breakdown).length == 0) return {
            [units.includes(referenceUnit) ? referenceUnit : units[0]]: 0
        }
        return breakdown;
    }

    measurement.prototype.toUnit = function(unit: U) {
        return convertUnit(this[referenceSymbol], table[unit]);
    };

    measurement.prototype.multiply = function(n: number) {
        return new measurement({
            [referenceUnit]: getReferenceValue(this) * n * referenceMultiplier
        } as any)
    };
    measurement.prototype.divide = function(n: number | M | Description<U>) {
        if (typeof n == "number") {
            return new measurement({
                [referenceUnit]: (getReferenceValue(this) / n) * referenceMultiplier
            } as any)
        }
        const divisor = fromDescription(n);
        return getReferenceValue(this) / getReferenceValue(divisor);
    };
    measurement.prototype.remainder = function(n: number) {
        return new measurement({
            [referenceUnit]: this.toUnit(referenceUnit) % n
        } as any);
    };
    measurement.prototype.blend = function(target: M | Description<U>, bias: number = .5) {
        const m = fromDescription(target);
        const thisReference = this.toUnit(referenceUnit);
        const targetReference = m.toUnit(referenceUnit);
        const blendedReference = thisReference + bias * (targetReference - thisReference);
        return new measurement({
            [referenceUnit]: blendedReference
        } as any);
    };
    measurement.prototype.add = function(...v: (M | Description<U>)[]) {
        const totalReference = v.reduce((acc, arg) => {
            const m = fromDescription(arg);
            return acc + getReferenceValue(m);
        }, this[referenceSymbol]);
        return new measurement({
            [referenceUnit]: totalReference * referenceMultiplier
        } as any)
    };
    measurement.prototype.subtract = function(v: M | Description<U>) {
        const m = fromDescription(v);
        return new measurement({
            [referenceUnit]: (this[referenceSymbol] - m[referenceSymbol]) * referenceMultiplier
        } as any)
    };
    measurement.prototype.breakdown = function(units?: string[], options?: BreakdownOptions) {
        return getBreakdown(this, units ?? formatDefaultUnits ?? Object.keys(table), {
            floatLast: !units,
            includeZero: !!units,
            ...options,
        });
    };
    measurement.prototype.formatNearest = function(
        target: number = formatDefaultTarget,
        units: (U)[] = formatDefaultUnits ?? Object.keys(table),
    ) {
        units = [...units];
        const referenceValue = this[referenceSymbol];
        const distances = Object.fromEntries(units.map(unit => [
            unit,
            Math.abs(target - convertUnit(referenceValue, table[unit])),
        ]));
        units.sort((a, b) => distances[b] - distances[a]);
        const unit = units.pop();
        const value = convertUnit(referenceValue, table[unit]);
        let label = suffices?.[unit] ?? ` ${unit}`;
        if (Array.isArray(label)) label = label[value === 1 ? 0 : 1];
        return value.toLocaleString(undefined, {
            maximumFractionDigits: 2
        }) + label;
    };
    measurement.prototype.toString = function(this: M) {
        return this.formatNearest();
    };
    measurement.prototype.toJSON = function() {
        const units = formatDefaultUnits ? [...formatDefaultUnits] : Object.keys(table);
        const referenceValue = this[referenceSymbol];
        const lengths = Object.fromEntries(units.map(unit => [
            unit,
            convertUnit(referenceValue, table[unit]).toString().length,
        ]));
        units.sort((a, b) => lengths[a] - lengths[b]);

        return getBreakdown(this, [units[0]], {
            includeZero: false,
            floatLast: true,
        });
    };
    measurement.prototype.floor = function(unit: U) {
        const value = Math.floor(this.toUnit(unit));
        return new measurement({[unit]: value} as any);
    };
    measurement.prototype.ceil = function(unit: U) {
        const value = Math.ceil(this.toUnit(unit));
        return new measurement({[unit]: value} as any);
    };
    measurement.prototype.round = function(unit: U) {
        const value = Math.round(this.toUnit(unit));
        return new measurement({[unit]: value} as any);
    };

    // comparison

    measurement.prototype.equals = function(target: M | Description<U>) {
        return this[referenceSymbol] === fromDescription(target)[referenceSymbol];
    };
    measurement.prototype.greaterThan = function(target: M | Description<U>) {
        return this[referenceSymbol] > fromDescription(target)[referenceSymbol];
    };
    measurement.prototype.greaterThanOrEqual = function(target: M | Description<U>) {
        return this[referenceSymbol] >= fromDescription(target)[referenceSymbol];
    };
    measurement.prototype.lessThan = function(target: M | Description<U>) {
        return this[referenceSymbol] < fromDescription(target)[referenceSymbol];
    };
    measurement.prototype.lessThanOrEqual = function(target: M | Description<U>) {
        return this[referenceSymbol] <= fromDescription(target)[referenceSymbol];
    };

    Object.defineProperties(measurement.prototype, {
        ...Object.fromEntries(Object.keys(table).map(unit => [
                "as" + capitalise(unit),
                {
                    enumerable: true,
                    configurable: false,
                    get() {
                        return this.toUnit(unit);
                    }
                }
            ]
        ))
    });

    // statics

    Object.defineProperties(measurement, {
        total: {
            configurable: false,
            value: (measurements: (M | Description<U>)[]) => measurements.reduce<M>((acc, m) => acc.add(m), new measurement({})),
        },
        ...Object.fromEntries(Object.keys(table).map(unit => [
            unit,
            {
                enumerable: true,
                configurable: false,
                value: (n: number) => new measurement({
                    [unit]: n
                } as any)
            }
        ]))
    })

    return measurement as MeasurementConstructor<U, FU>;
}

export const Distance = createMeasurement({
    metres: 1,
    kilometres: .001,
    centimetres: 100,
    millimetres: 1000,
    inches: 39.37007874,
    feet: 3.28084,
    yards: 1.093613,
    cubits: 2.1872266,
    miles: .0006213712,
    nauticalMile: .0005399568,
}, {
    referenceUnit: "metres",
    format: {
        suffices: {
            centimetres: "cm",
            feet: "'",
            inches: "\"",
            kilometres: "km",
            metres: [" metre", " metres"],
            miles: [" mile", " miles"],
            millimetres: "mm",
            nauticalMile: [" nautical mile", " nautical miles"]
        },
        defaultTarget: 500,
        units: ["millimetres", "centimetres", "metres", "kilometres"],
    }
});
export type Distance = MeasurementType<typeof Distance>;

export const Angle = createMeasurement({
    degrees: 180,
    radians: Math.PI,
    turns: .5,
}, {
    referenceUnit: "degrees",
    format: {
        suffices: {
            degrees: "°",
            radians: [" radian", " radians"],
            turns: [" turn", " turns"],
        },
        units: ["degrees"]
    }
});
export type Angle = MeasurementType<typeof Angle>;

export const Period = createMeasurement({
    seconds: 900,
    minutes: 15,
    hours: 0.25,
    days: 0.01041667,
    weeks: 0.001488095,
    microfortnights: 744.05,
    milliseconds: 900000
}, {
    format: {
        suffices: {
            seconds: "s",
            days: [" day", " days"],
            hours: "h",
            minutes: "m",
            milliseconds: "ms",
            weeks: [" week", " weeks"],
        },
        units: ["weeks", "days", "hours", "minutes", "seconds", "milliseconds"],
        defaultTarget: 30,
    }
});
export type Period = MeasurementType<typeof Period>;

export const Weight = createMeasurement({
    grams: 500,
    kilograms: 0.5,
    tonnes: 0.0005,
    ounces: 17.63698,
    pounds: 1.102311,
    stones: 0.07873652
}, {
    format: {
        suffices: {
            grams: "g",
            kilograms: "kg",
            tonnes: ["tonne", "tonnes"],
            ounces: "oz",
            pounds: "lb",
            stones: "st",
        },
        defaultTarget: 500,
        units: ["grams", "kilograms", "tonnes"],
    }
});

export type Weight = MeasurementType<typeof Weight>;

export const DataSize = createMeasurement({
    pebibytes: 1,
    tebibytes: 1024,
    gibibytes: 1024 * 1024,
    mebibytes: 1024 * 1024 * 1024,
    kibibytes: 1024 * 1024 * 1024 * 1024,
    bytes: 1024 * 1024 * 1024 * 1024 * 1024,
}, {
    referenceUnit: "bytes",
    format: {
        suffices: {
            bytes: " b",
            kibibytes: " KiB",
            mebibytes: " MiB",
            gibibytes: " GiB",
            tebibytes: " TiB",
            pebibytes: " PiB",
        },
        defaultTarget: 512,
    }
});

export type DataSize = MeasurementType<typeof DataSize>;

export const Frequency = createMeasurement({
    hertz: 1,
    kilohertz: 0.001,
    megahertz: 0.000001,
    gigahertz: 0.000000001,
    cyclesPerMinute: 60,
}, {
    referenceUnit: "hertz",
    format: {
        suffices: {
            hertz: ' Hz',
            kilohertz: ' kHz',
            megahertz: ' MHz',
            gigahertz: " GHz",
            cyclesPerMinute: " cpm",
        },
        defaultTarget: 500,
        units: ["hertz", "kilohertz", "megahertz", "gigahertz"],
    },
});

export type Frequency = MeasurementType<typeof Frequency>;