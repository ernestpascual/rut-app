import React from 'react';

export const Feather: any = ({ name, size, color, style }: any) => {
  return React.createElement('Text', { style, testID: `feather-${name}` }, name);
};
Feather.font = { feather: 'feather.ttf' };
Feather.loadFont = () => Promise.resolve();

export default { Feather };
