"use strict";

module.exports = {
    shuffle: (array) => {
        const copy = array.slice();

        for (let index = copy.length; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * index);
            index -= 1;
            const element = copy[index];
            copy[index] = copy[randomIndex];
            copy[randomIndex] = element;
        }

        return copy;
    },
};
