import React from 'react';

export const Feather = ({ name, size, color, style }: any) => {
  return React.createElement('Text', { style, testID: `feather-${name}` }, name);
};

export default { Feather };
