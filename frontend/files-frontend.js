var labelVal;

function addEvent() {
    labelVal = document.getElementById('filelbl').innerHTML;
    
    document.getElementsByClassName('filein')[0].addEventListener('change', function(e) {
        if (this.files) labelVal = e.target.value.split('\\').pop();
        document.getElementById('filelbl').innerHTML = labelVal;
    });
}

