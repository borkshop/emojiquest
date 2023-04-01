export type Keep = {
  type: 'keep';
  start: number;
  length: number;
};

export type Skip = {
  type: 'skip';
  length: number;
};

export type Span = Keep | Skip;

export type Operation = Array<Span>;
