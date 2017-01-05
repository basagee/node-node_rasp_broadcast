// contains 메소드 추가
if (!Array.prototype.contains) {
    Array.prototype.contains = function(element){
        return this.indexOf(element) > -1;
    };
}
