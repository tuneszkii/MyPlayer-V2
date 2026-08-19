import { MemoryRouter } from 'react-router-dom';
import { MyplayerBuilder } from "./myplayer-builder.js";
    
export const MyplayerBuilderBasic = () => {
  return (
    <MemoryRouter>
      <MyplayerBuilder />
    </MemoryRouter>
  );
}