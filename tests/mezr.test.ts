import { Angle, createMeasurement, Distance } from "../src/mezr";

describe("cross-type functionality", () => {

  it("should create instances with <Type>.<units>()", () => {
    const in3 = Distance.inches(3);
    expect(in3).toBeInstanceOf(Distance);
    expect(in3.asInches).toBe(3);
    expect(Angle.radians(2)).toBeInstanceOf(Angle);
  });

  it("should create instances with [new] <Type>(table)", () => {
    const in3 = new Distance({inches: 3});
    expect(in3).toBeInstanceOf(Distance);
    expect(in3.asInches).toBe(3);
    expect(Angle({radians: 2})).toBeInstanceOf(Angle);
  });

  it('should correctly add measurements', () => {
    const total = Distance.metres(5).add(Distance.metres(3));
    expect(total.asMetres).toBe(8);
  });

  it("should provide accurate conversion", () => {
    const distance = Distance.kilometres(1);
    expect(distance.asMetres).toBe(1000);
  });

  it('should correctly add measurement descriptions', () => {
    const total = Distance.metres(5).add({centimetres: 300});
    expect(total.asMetres).toBe(8);
  });

  it('should correctly subtract measurements', () => {
    const difference = Distance.metres(5).subtract(Distance.metres(3));
    expect(difference.asMetres).toBe(2);
  });

  it('should correctly subtract measurement descriptions', () => {
    const difference = Distance.metres(5).subtract({centimetres: 300});
    expect(difference.asMetres).toBe(2);
  });

  it('should provide the absolute value of a measurement', () => {
    const absDistance = Distance.metres(-5).absolute;
    expect(absDistance.asMetres).toBe(5);
  });

  it("should multiply measurements", () => {
    const doubled = Distance.metres(2).multiply(3);
    expect(doubled.asMetres).toBeCloseTo(6);
  });

  it("should add multiple measurements", () => {
    const cm120 = Distance.centimetres(120);
    const distance = Distance.metres(3).add(
      { kilometres: 1 },
      cm120,
    );
    expect(distance.asCentimetres).toEqual(100420);
  });

  it("should floor by given unit", () => {
    const distance = Distance.centimetres(150);
    expect(distance.floor("metres").asCentimetres).toBe(100);
  });

  it("should ceil by given unit", () => {
    const distance = Distance.centimetres(150);
    expect(distance.ceil("metres").asCentimetres).toBe(200);
  });

  it("should round by given unit", () => {
    const cm120 = Distance.centimetres(120);
    const cm160 = Distance.centimetres(160);
    expect(cm120.round("metres").asCentimetres).toBe(100);
    expect(cm160.round("metres").asCentimetres).toBe(200);
  });

  it("should format to unit with nearest value", () => {
    const distance = Distance.centimetres(500);
    expect(distance.formatNearest(6)).toBe("5 metres")
    expect(distance.formatNearest(400)).toBe("500cm")
  });

  it("should blend two measurements with given bias", () => {
    const left = Angle.degrees(10);
    const right = Angle.degrees(20);
    expect(left.blend(right, .5).asDegrees).toBe(15);
    expect(left.blend(right, .25).asDegrees).toBe(12.5);
    expect(left.blend(right, .75).asDegrees).toBe(17.5);
  });

  it("should correctly compare measurements less than, greater than and/or equal to", () => {
    const small = Distance.inches(5);
    const large = Distance.metres(5);
    expect(small.equals(large)).toBeFalsy();
    expect(small.lessThan(large)).toBeTruthy();
    expect(small.lessThanOrEqual(large)).toBeTruthy();
    expect(large.equals(small)).toBeFalsy();
    expect(large.lessThan(small)).toBeFalsy();
    expect(large.lessThanOrEqual(small)).toBeFalsy();
    expect(small.equals({inches: 5})).toBeTruthy();
    expect(small.lessThanOrEqual({inches: 5})).toBeTruthy();
    expect(small.greaterThanOrEqual({inches: 5})).toBeTruthy();
  });

  it("should calculate totals", () => {
    const total = Distance.total([
      Distance.metres(2),
      {centimetres: 50},
      Distance.millimetres(300),
    ]);
    expect(total.asCentimetres).toBe(280);
  });


  it("should create custom measurement types", () => {
    const GameDistance = createMeasurement({
      mapUnits: 1,
      metres: 1/64,
      playerSteps: 1 / 24,
    }, {
      format: {
        units: ["mapUnits"],
        suffices: {
          mapUnits: "u",
          metres: "m",
        }
      }
    });
    expect(GameDistance.playerSteps(1).multiply(2).asMapUnits).toBe(48);
    expect(GameDistance.metres(2).formatNearest()).toBe("128u");
  });

  it("should not allow constructor calls with foreign 'this'", () => {
    expect(jest.fn(() => {
      Distance.call({});
    })).toThrow();
  });

});
  