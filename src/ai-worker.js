import { chooseAction } from "./ai.js";
self.onmessage = ({ data }) => {
  const { token, state, difficulty } = data;
  try {
    self.postMessage({
      token,
      revision: state.revision,
      action: chooseAction(state, difficulty),
    });
  } catch (error) {
    self.postMessage({
      token,
      revision: state.revision,
      error: String(error.message),
    });
  }
};
