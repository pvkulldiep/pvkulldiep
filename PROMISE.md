- Promise

const promise = new Promise((resolve, reject) => {
   setTimeout(() => {
     resolve('Fullfilled');
   }, 1000);
   
});

promise.then((result) => {
    // Until the above condition is executed, the promise will be in Pending State.
    // If the condition is fullfilled, the below function is executed, else it goesto the catch block.
    console.log(result);
}).catch((error) => {
    // If the condition is not fullfilled, the catch block is executed.
    console.error(error);
}).finally(() => {
    console.log('Promise is settled');
})



