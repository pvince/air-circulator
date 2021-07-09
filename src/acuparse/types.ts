export interface ITower {
    name: string,
    tempF: number,
    relH: string,
    lastUpdated: Date
}

export interface ITowerList {
    [key: string]: ITower
}

export interface ITowerListResult {
    towers: ITowerList
}
