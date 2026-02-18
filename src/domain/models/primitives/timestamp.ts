/**
 * Timestamp Value Object
 * Represents a point in time
 */
export class Timestamp {
    private readonly value: Date;

    private constructor(value: Date) {
        this.value = value;
    }

    static now(): Timestamp {
        return new Timestamp(new Date());
    }

    static from(value: Date | number | string): Timestamp {
        if (value instanceof Date) {
            return new Timestamp(value);
        }
        return new Timestamp(new Date(value));
    }

    static fromUnixSeconds(seconds: number): Timestamp {
        return new Timestamp(new Date(seconds * 1000));
    }

    static fromUnixMilliseconds(milliseconds: number): Timestamp {
        return new Timestamp(new Date(milliseconds));
    }

    toDate(): Date {
        return new Date(this.value);
    }

    toUnixSeconds(): number {
        return Math.floor(this.value.getTime() / 1000);
    }

    toUnixMilliseconds(): number {
        return this.value.getTime();
    }

    toISOString(): string {
        return this.value.toISOString();
    }

    isBefore(other: Timestamp): boolean {
        return this.value.getTime() < other.value.getTime();
    }

    isAfter(other: Timestamp): boolean {
        return this.value.getTime() > other.value.getTime();
    }

    isSameOrBefore(other: Timestamp): boolean {
        return this.value.getTime() <= other.value.getTime();
    }

    isSameOrAfter(other: Timestamp): boolean {
        return this.value.getTime() >= other.value.getTime();
    }

    addSeconds(seconds: number): Timestamp {
        return new Timestamp(new Date(this.value.getTime() + seconds * 1000));
    }

    addMinutes(minutes: number): Timestamp {
        return this.addSeconds(minutes * 60);
    }

    addHours(hours: number): Timestamp {
        return this.addMinutes(hours * 60);
    }

    addDays(days: number): Timestamp {
        return this.addHours(days * 24);
    }

    differenceInSeconds(other: Timestamp): number {
        return Math.floor((this.value.getTime() - other.value.getTime()) / 1000);
    }

    differenceInMinutes(other: Timestamp): number {
        return Math.floor(this.differenceInSeconds(other) / 60);
    }

    differenceInHours(other: Timestamp): number {
        return Math.floor(this.differenceInMinutes(other) / 60);
    }

    differenceInDays(other: Timestamp): number {
        return Math.floor(this.differenceInHours(other) / 24);
    }
}
